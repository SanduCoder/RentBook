import { Location } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { navigateBack } from '../../core/utils/navigate-back.util';
import { canManageTenants } from '../../core/utils/role.utils';

interface HelpTopic {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  managerOnly?: boolean;
  tenantOnly?: boolean;
}

const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'navigation',
    title: 'Getting around RentBook',
    summary: 'How the main navigation works on phone and desktop.',
    steps: [
      'Use the bottom bar: Home (dashboard), Properties, Tenants, Payment, and More.',
      'More holds settings, reports, expenses, shared bills, and your account.',
      'Tap the back arrow at the top of a page to return where you came from.',
      'Many list items open a detail screen — use back to return to the list.',
    ],
  },
  {
    id: 'dashboard',
    title: 'Dashboard (Home)',
    summary: 'Your monthly snapshot at a glance.',
    steps: [
      'Expected Rent — total rent if every unit is occupied.',
      'Collected This Month — payments received; the bar shows % of expected rent.',
      'Outstanding Rent — unpaid balances carried from move-in, not just this month.',
      'Vacant Units — empty units and estimated rent you are not collecting.',
      'Tap a maintenance or payment item in Recent Activity to jump to that record.',
    ],
    managerOnly: true,
  },
  {
    id: 'dashboard-tenant',
    title: 'Dashboard (Home)',
    summary: 'What tenants see on the home screen.',
    steps: [
      'Quick actions let you report a payment or open maintenance.',
      'Rent reminders from your landlord appear at the top when sent.',
      'Use More → My Payments to see your full payment history.',
    ],
    tenantOnly: true,
  },
  {
    id: 'properties',
    title: 'Properties & units',
    summary: 'Set up buildings and rooms you manage.',
    steps: [
      'Properties → + to add a compound, apartment, or other property type.',
      'Open a property → Units tab to add rooms and set monthly rent per unit.',
      'Each property has its own invite code on the Overview tab — share it so tenants can join.',
      'Country and currency are set when you create a property; change your default under More → Country & region.',
    ],
    managerOnly: true,
  },
  {
    id: 'tenants',
    title: 'Tenants & invites',
    summary: 'Connect tenants to units.',
    steps: [
      'Share your owner invite code (More page) or the property code from a property’s Overview.',
      'When a tenant registers with your code, they appear under Tenants as pending — assign property and unit.',
      'Or add a tenant manually: Tenants → + Add Tenant, pick property, unit, and rent.',
      'Send Reminder on overdue tenants opens WhatsApp with a pre-filled rent message.',
    ],
    managerOnly: true,
  },
  {
    id: 'payments',
    title: 'Recording payments',
    summary: 'Log rent received and verify tenant reports.',
    steps: [
      'Payments → + to record rent: pick tenant, amount, method, and date.',
      'Tenants can report payments themselves; those show as “To verify” until you confirm.',
      'Payment methods match the property’s country (e.g. Wave, bank transfer, Zelle).',
      'Each recorded payment gets a receipt number you can share.',
    ],
    managerOnly: true,
  },
  {
    id: 'tenant-payments',
    title: 'Reporting your rent payment',
    summary: 'Tell your landlord you have paid.',
    steps: [
      'Payment tab → Report Payment (or use the dashboard quick action).',
      'Enter amount, method, transaction reference, and date.',
      'Your landlord reviews and confirms; status updates in My Payments.',
    ],
    tenantOnly: true,
  },
  {
    id: 'maintenance',
    title: 'Maintenance requests',
    summary: 'Report and track repairs.',
    steps: [
      'Tenants: More or dashboard → report an issue with a title and description.',
      'Owners: Requests lists all open jobs; open one to update status or mark completed.',
      'Tap a maintenance item on the dashboard Recent Activity to find it quickly.',
    ],
  },
  {
    id: 'expenses-bills',
    title: 'Expenses & shared bills',
    summary: 'Track property costs and split utilities.',
    steps: [
      'Expenses — log water, repairs, salaries, and other costs per property.',
      'Shared Bills — enter a total (e.g. water bill) and number of households; RentBook calculates each share.',
      'Both appear on the property detail tabs and in More.',
    ],
    managerOnly: true,
  },
  {
    id: 'reports',
    title: 'Reports',
    summary: 'Monthly income vs expenses.',
    steps: [
      'More → Reports shows income (confirmed payments), expenses, and net profit for this month.',
      'If you manage properties in different currencies, totals warn you when amounts cannot be combined.',
    ],
    managerOnly: true,
  },
  {
    id: 'country',
    title: 'Country & region',
    summary: 'Currency and payment methods for your account.',
    steps: [
      'More → Country & region to set your country.',
      'This updates your default currency and available payment methods.',
      'Properties in your previous country sync to the new currency — review unit rents after changing.',
    ],
  },
  {
    id: 'account',
    title: 'Account & profile',
    summary: 'Your name, phone, and password.',
    steps: [
      'Tap your profile card at the top of More → My Account.',
      'Update name and phone; use Send password reset email if you forgot your password.',
      'Sign out from the bottom of the More page.',
    ],
  },
  {
    id: 'join',
    title: 'Linking your tenancy',
    summary: 'For new tenants joining a landlord.',
    steps: [
      'Register with the invite code from your landlord, or enter it after signing up via More → join prompts.',
      'Enter the property code, then pick your vacant unit to finish setup.',
      'Once linked, you can report payments and maintenance from the app.',
    ],
    tenantOnly: true,
  },
];

@Component({
  selector: 'app-help-support',
  standalone: true,
  templateUrl: './help-support.component.html',
  styleUrl: './help-support.component.scss',
})
export class HelpSupportComponent {
  private auth = inject(AuthService);
  private location = inject(Location);
  private router = inject(Router);

  user = this.auth.currentUser;

  topics = computed(() => {
    const isManager = canManageTenants(this.user()?.role);
    return HELP_TOPICS.filter((topic) => {
      if (topic.managerOnly && !isManager) return false;
      if (topic.tenantOnly && isManager) return false;
      return true;
    });
  });

  goBack(event: Event): void {
    event.preventDefault();
    navigateBack(this.location, this.router, ['/more']);
  }
}
