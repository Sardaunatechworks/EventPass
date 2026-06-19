// ============================================================
// EventPass: src/modules/organization/staff.js
// Team member management
// ============================================================
import { OrganizationService } from '../../services/organization.service.js';
import { DataTable } from '../../components/table.js';
import { Toast } from '../../components/toast.js';
import { confirmModal, openModal, closeModal } from '../../components/modal.js';
import { formatDate } from '../../utils/formatters.js';
import { isValidEmail } from '../../utils/validators.js';
import { Config } from '../../config.js';

const ROLE_OPTIONS = Config.roles.map(r => ({
  value: r,
  label: { owner:'Owner', admin:'Admin', event_manager:'Event Manager', staff:'Staff', volunteer:'Volunteer' }[r] || r,
}));

export async function renderOrgStaff(container, session) {
  const { org, currentMember, permissions } = session;
  const canManage = permissions?.can('org:members:manage');

  container.innerHTML = `
    <div style="padding:var(--space-6);max-width:900px;">
      <div class="page-header">
        <div>
          <h1 class="page-title">Team & Staff</h1>
          <p class="page-subtitle">Manage who has access to your organization</p>
        </div>
        ${canManage ? `
          <button class="btn btn-primary" id="invite-btn">+ Add Member</button>
        ` : ''}
      </div>

      <div id="staff-table"></div>
    </div>
  `;

  const table = new DataTable(container.querySelector('#staff-table'), {
    columns: [
      {
        label: 'Member',
        render: (row) => {
          const email = row['auth.users']?.email || row.invite_email || '—';
          const initials = email.slice(0, 2).toUpperCase();
          return `
            <div class="flex items-center gap-3">
              <div class="avatar">${initials}</div>
              <div>
                <div class="font-medium">${email}</div>
                ${row.invite_email && !row.accepted_at ? `<div class="text-xs badge badge-yellow">Invite Pending</div>` : ''}
              </div>
            </div>
          `;
        },
      },
      {
        key: 'role',
        label: 'Role',
        type: 'badge',
        badgeConfig: (v) => ({
          owner: { label: 'Owner', class: 'badge-purple' },
          admin: { label: 'Admin', class: 'badge-blue' },
          event_manager: { label: 'Event Manager', class: 'badge-green' },
          staff: { label: 'Staff', class: 'badge-gray' },
          volunteer: { label: 'Volunteer', class: 'badge-orange' },
        }[v] || { label: v, class: 'badge-gray' }),
        width: '140px',
      },
      {
        key: 'accepted_at',
        label: 'Joined',
        render: (row) => row.accepted_at
          ? formatDate(row.accepted_at, 'short')
          : `<span class="text-muted">Pending</span>`,
        width: '120px',
      },
    ],
    fetchData: async (params) => {
      const result = await OrganizationService.listMembers(org.id, {
        page: params.page,
        pageSize: params.pageSize,
      });
      return { data: result.members, total: result.total };
    },
    actions: canManage ? [
      {
        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
        label: 'Copy Invite Link',
        onClick: (row) => {
          const inviteUrl = `${Config.app.url}/app.html?invite=${row.id}`;
          navigator.clipboard.writeText(inviteUrl).then(() => {
            Toast.success('Invite link copied to clipboard!');
          }).catch(() => {
            Toast.error('Failed to copy link.');
          });
        },
        hidden: (row) => !row.invite_email || row.accepted_at,
      },
      {
        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
        label: 'Change Role',
        onClick: (row) => showChangeRoleModal(row, org, currentMember, () => table.refresh()),
        hidden: (row) => row.role === 'owner',
      },
      {
        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
        label: 'Remove',
        onClick: (row) => {
          confirmModal({
            title: 'Remove Member',
            message: `Remove this member from ${org.name}? They will lose all access.`,
            confirmLabel: 'Remove',
            onConfirm: async () => {
              try {
                await OrganizationService.removeMember(row.id, org.id);
                Toast.success('Member removed');
                table.refresh();
              } catch (err) {
                Toast.error(err.message);
              }
            },
          });
        },
        hidden: (row) => row.role === 'owner',
      },
    ] : [],
    emptyTitle: 'No team members',
    emptyText: 'Invite staff to help manage events.',
    emptyIcon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  });

  await table.render();

  // Invite button
  container.querySelector('#invite-btn')?.addEventListener('click', () => {
    showInviteModal(org, session, () => table.refresh());
  });
}

function showInviteModal(org, session, onSuccess) {
  openModal({
    title: 'Add Team Member',
    content: `
      <form id="invite-form" novalidate>
        <div class="form-group">
          <label class="form-label" for="inv-fullname">Full Name *</label>
          <input type="text" id="inv-fullname" name="fullName" class="input" placeholder="Jane Adeyemi" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="inv-email">Email Address *</label>
          <input type="email" id="inv-email" name="email" class="input" placeholder="colleague@company.com" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="inv-password">Temporary Password *</label>
          <input type="text" id="inv-password" name="tempPassword" class="input" placeholder="Min. 8 characters" required minlength="8">
        </div>
        <div class="form-group">
          <label class="form-label" for="inv-role">Role *</label>
          <select id="inv-role" name="role" class="select">
            ${ROLE_OPTIONS.filter(r => r.value !== 'owner').map(r => `
              <option value="${r.value}">${r.label}</option>
            `).join('')}
          </select>
          <p class="form-hint">Staff can check in participants. Event Managers can create and manage events. Admins have full access except billing.</p>
        </div>
        <div id="inv-error" class="field-error" style="display:none;" role="alert"></div>
      </form>
    `,
    actions: [
      { label: 'Cancel', class: 'btn-secondary', closeOnClick: true },
      {
        label: 'Add Member',
        class: 'btn btn-primary',
        closeOnClick: false,
        onClick: async (e) => {
          const form = document.getElementById('invite-form');
          const errEl = form.querySelector('#inv-error');
          const fullName = form.fullName.value.trim();
          const email = form.email.value.trim();
          const tempPassword = form.tempPassword.value.trim();
          const role = form.role.value;

          errEl.style.display = 'none';
          if (!fullName) {
            errEl.textContent = 'Please enter a full name.';
            errEl.style.display = 'block';
            return;
          }
          if (!isValidEmail(email)) {
            errEl.textContent = 'Please enter a valid email.';
            errEl.style.display = 'block';
            return;
          }
          if (tempPassword.length < 8) {
            errEl.textContent = 'Temporary password must be at least 8 characters.';
            errEl.style.display = 'block';
            return;
          }

          const btn = e.target;
          btn.disabled = true;
          btn.innerHTML = '<span class="loading-spinner sm"></span>';

          try {
            await OrganizationService.createStaffMember(org.id, fullName, email, role, tempPassword);
            closeModal();
            Toast.success(`Team member ${fullName} added successfully!`);
            if (onSuccess) onSuccess();
          } catch (err) {
            errEl.textContent = err.message;
            errEl.style.display = 'block';
            btn.disabled = false;
            btn.innerHTML = 'Add Member';
          }
        },
      },
    ],
  });
}

function showChangeRoleModal(member, org, currentMember, onSuccess) {
  openModal({
    title: 'Change Member Role',
    content: `
      <p class="text-secondary mb-4">Update the role for this team member.</p>
      <div class="form-group">
        <label class="form-label" for="cr-role">New Role</label>
        <select id="cr-role" class="select">
          ${ROLE_OPTIONS.filter(r => r.value !== 'owner').map(r => `
            <option value="${r.value}" ${member.role === r.value ? 'selected' : ''}>${r.label}</option>
          `).join('')}
        </select>
      </div>
    `,
    size: 'sm',
    actions: [
      { label: 'Cancel', class: 'btn-secondary', closeOnClick: true },
      {
        label: 'Update Role',
        class: 'btn btn-primary',
        onClick: async () => {
          const role = document.getElementById('cr-role').value;
          try {
            await OrganizationService.updateMemberRole(member.id, org.id, role);
            Toast.success('Role updated');
            if (onSuccess) onSuccess();
          } catch (err) {
            Toast.error(err.message);
          }
        },
      },
    ],
  });
}
