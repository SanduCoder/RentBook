import { EnvironmentInjector, Injectable, inject } from '@angular/core';
import {
  Firestore,
  Timestamp,
  addDoc,
  collection,
  doc,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import { RentReminder } from '../models/rent-reminder.model';
import { observeQuery } from '../utils/firestore-observable';
import { stripUndefined, toDate } from '../utils/firestore.utils';
import {
  RentReminderDetails,
  buildRentReminderMessage,
  openWhatsAppReminder,
} from '../utils/rent-reminder.utils';

export interface SendRentReminderParams {
  tenantId: string;
  propertyId: string;
  recipientUserId?: string;
  details: RentReminderDetails;
  sentBy: string;
  sentByName: string;
  openWhatsApp?: boolean;
}

@Injectable({ providedIn: 'root' })
export class RentReminderService {
  private firestore = inject(Firestore);
  private injector = inject(EnvironmentInjector);
  private collection = collection(this.firestore, 'rentReminders');

  getForTenant(tenantId: string): Observable<RentReminder[]> {
    return observeQuery<RentReminder>(this.injector, () =>
      query(this.collection, where('tenantId', '==', tenantId))
    ).pipe(map((items) => this.normalize(items).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())));
  }

  getUnreadForTenant(tenantId: string): Observable<RentReminder[]> {
    return this.getForTenant(tenantId).pipe(map((items) => items.filter((item) => !item.read)));
  }

  async sendFromDue(
    due: {
      tenantId: string;
      propertyId: string;
      tenantName: string;
      unitName: string;
      phone: string;
      monthlyRent: number;
      dueDate: Date;
      isOverdue: boolean;
      recipientUserId?: string;
    },
    currency: string,
    sender: { id: string; name: string },
    countryCode?: string
  ): Promise<void> {
    await this.send({
      tenantId: due.tenantId,
      propertyId: due.propertyId,
      recipientUserId: due.recipientUserId,
      details: {
        tenantName: due.tenantName,
        unitName: due.unitName,
        phone: due.phone,
        monthlyRent: due.monthlyRent,
        currency,
        countryCode,
        dueDate: due.dueDate,
        isOverdue: due.isOverdue,
        landlordName: sender.name,
      },
      sentBy: sender.id,
      sentByName: sender.name,
    });
  }

  async sendForTenant(
    tenant: {
      id: string;
      propertyId: string;
      name: string;
      phone: string;
      monthlyRent: number;
      userId?: string;
    },
    unitName: string,
    currency: string,
    rentStatus: { dateValue: Date; status: string },
    sender: { id: string; name: string },
    countryCode?: string
  ): Promise<void> {
    await this.send({
      tenantId: tenant.id,
      propertyId: tenant.propertyId,
      recipientUserId: tenant.userId,
      details: {
        tenantName: tenant.name,
        unitName,
        phone: tenant.phone,
        monthlyRent: tenant.monthlyRent,
        currency,
        countryCode,
        dueDate: rentStatus.dateValue,
        isOverdue: rentStatus.status === 'overdue',
        landlordName: sender.name,
      },
      sentBy: sender.id,
      sentByName: sender.name,
    });
  }

  async send(params: SendRentReminderParams): Promise<void> {
    const message = buildRentReminderMessage(params.details);

    await addDoc(
      this.collection,
      stripUndefined({
        tenantId: params.tenantId,
        propertyId: params.propertyId,
        recipientUserId: params.recipientUserId,
        unitName: params.details.unitName,
        message,
        monthlyRent: params.details.monthlyRent,
        currency: params.details.currency,
        dueDate: Timestamp.fromDate(params.details.dueDate),
        isOverdue: params.details.isOverdue,
        read: false,
        sentBy: params.sentBy,
        sentByName: params.sentByName,
        createdAt: serverTimestamp(),
      })
    );

    if (params.openWhatsApp !== false && params.details.phone) {
      openWhatsAppReminder(params.details.phone, message, params.details.countryCode);
    }
  }

  async markAsRead(reminderId: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'rentReminders', reminderId), { read: true });
  }

  private normalize(items: (RentReminder & { id: string })[]): RentReminder[] {
    return items.map((item) => ({
      ...item,
      dueDate: toDate(item.dueDate),
      createdAt: toDate(item.createdAt),
      read: !!item.read,
    }));
  }
}
