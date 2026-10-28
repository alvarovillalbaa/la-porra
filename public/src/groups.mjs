import { el, button, field, notice, emptyState, formatDate } from './ui.mjs';

let nextConfirmation = 0;

function memberCount(count) {
  return `${count} ${count === 1 ? 'persona' : 'personas'}`;
}

function roleTag(group) {
  return el('span', { className: 'status-pill' }, group.role === 'owner' ? 'Tu rol: propietario' : 'Tu rol: miembro');
}

// Disable synchronously: a second submit cannot outrun the controller's next render.
function pendingFieldset(busy, legend) {
  let pending = false;
  const fieldset = el('fieldset', { className: 'action-fieldset', disabled: busy, 'aria-busy': String(busy) },
    el('legend', { className: 'visually-hidden' }, legend));
  return {
    fieldset,
    async run(action) {
      if (busy || pending) return;
      const focused = fieldset.contains(document.activeElement) ? document.activeElement : null;
      pending = true;
      fieldset.disabled = true;
      fieldset.setAttribute('aria-busy', 'true');
      try {
        await action();
      } finally {
        pending = false;
        fieldset.disabled = busy;
        fieldset.setAttribute('aria-busy', String(busy));
        if (focused?.isConnected && document.activeElement === document.body) focused.focus();
      }
    },
  };
}

function groupForm({ title, description, label, hint, draftName, value, submitLabel, busy, code = false }, actions, submit) {
  const local = pendingFieldset(busy, title);
  const input = el('input', {
    id: code ? 'group-invite-code' : 'group-new-name', type: 'text', name: draftName, value, required: true,
    ...(code ? { minlength: 16, maxlength: 256, pattern: '[A-Za-z0-9_-]+', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' } : {}),
    onInput: event => {
      event.currentTarget.setCustomValidity('');
      actions.changeGroupDraft(draftName, event.currentTarget.value);
    },
  });
  const form = el('form', {
    className: 'group-form', 'aria-label': title,
    onSubmit: event => {
      event.preventDefault();
      const next = input.value.trim();
      if (!next) {
        input.setCustomValidity(code ? 'Introduce un código de invitación.' : 'Escribe un nombre para el grupo.');
        input.reportValidity();
        return;
      }
      if (!form.reportValidity()) return;
      void local.run(() => submit(next));
    },
  }, el('h2', {}, title), el('p', { className: 'muted' }, description), local.fieldset);
  local.fieldset.append(field(label, input, { hint }), button(submitLabel, null, { type: 'submit', variant: 'primary' }));
  return form;
}

export function renderGroups({ groups, selectedGroupId, session, busy, drafts }, actions) {
  const list = groups.length
    ? el('nav', { 'aria-label': 'Tus grupos' },
      el('ul', { className: 'group-list' }, groups.map(group => el('li', {},
        button([
          el('span', { className: 'group-card__name' }, group.name),
          el('span', { className: 'group-card__meta' }, memberCount(group.memberCount)),
          roleTag(group),
          group.id === selectedGroupId ? el('span', { className: 'group-card__selected' }, 'Seleccionado') : null,
        ], () => actions.selectGroup(group.id), {
          className: 'group-card', disabled: busy, 'aria-current': group.id === selectedGroupId ? 'true' : null,
        })))))
    : emptyState('La porra empieza con tu gente', 'Crea un grupo para tus amigos o entra con un código de invitación.');
  return el('section', { className: 'view groups-view', 'aria-label': 'Grupos' },
    el('header', { className: 'view-heading' },
      el('p', { className: 'eyebrow' }, `Hola, ${session.user.displayName}`),
      el('h1', {}, 'Tus grupos'),
      el('p', {}, 'Un sitio para compartir pronósticos, celebrar aciertos y seguir los puntos entre amigos.')),
    list,
    el('div', { className: 'group-forms' },
      groupForm({ title: 'Crear un grupo', description: 'Dale un nombre que reconozcáis todos.',
        label: 'Nombre del grupo', draftName: 'newGroupName', value: drafts.newGroupName,
        submitLabel: 'Crear grupo', busy }, actions, name => actions.createGroup(name)),
      groupForm({ title: 'Entrar con invitación', description: 'Si tus amigos ya tienen grupo, únete con su código.',
        label: 'Código de invitación', hint: 'Introduce el código completo que te han compartido.',
        draftName: 'inviteCode', value: drafts.inviteCode, submitLabel: 'Entrar en el grupo', busy, code: true },
      actions, code => actions.redeemInvitation(code))));
}

function confirmation({ label, title, description, confirmLabel, busy, run }) {
  const id = `group-confirmation-${++nextConfirmation}`;
  const local = pendingFieldset(busy, title);
  const confirm = button(confirmLabel, () => { void local.run(run); }, { variant: 'danger' });
  const panel = el('div', { id, className: 'confirmation-panel', hidden: true, role: 'group', 'aria-label': title },
    el('p', {}, el('strong', {}, title)), el('p', {}, description), local.fieldset);
  const trigger = button(label, () => {
    if (busy) return;
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    confirm.focus();
  }, { variant: 'danger', disabled: busy, 'aria-controls': id, 'aria-expanded': 'false' });
  const cancel = button('Cancelar', () => {
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (trigger.isConnected) trigger.focus();
  });
  local.fieldset.append(el('div', { className: 'inline-actions' }, confirm, cancel));
  return el('div', { className: 'confirmation-action' }, trigger, panel);
}

function invitationCard(group, invitation, index, busy, actions) {
  const copy = pendingFieldset(busy, `Copiar código de la invitación ${index + 1}`);
  if (invitation.code !== null) copy.fieldset.append(
    el('code', { className: 'invitation-code' }, invitation.code),
    button('Copiar código', () => { void copy.run(() => actions.copyInvitation(invitation.code)); }));
  return el('li', { className: 'invitation-card' },
    el('header', { className: 'section-heading' }, el('h3', {}, `Invitación ${index + 1}`),
      el('span', { className: 'status-pill' }, invitation.revoked ? 'Revocada' : 'Sin revocar')),
    el('dl', { className: 'invitation-facts' },
      el('div', {}, el('dt', {}, 'Caduca'), el('dd', {}, el('time', { datetime: invitation.expiresAt }, formatDate(invitation.expiresAt)))),
      el('div', {}, el('dt', {}, 'Usos restantes'), el('dd', {}, invitation.usesRemaining))),
    invitation.code !== null ? copy.fieldset : el('p', { className: 'muted' }, 'El código no se incluye en esta vista.'),
    group.permissions.canInvite && !invitation.revoked ? confirmation({
      label: 'Revocar invitación', title: `¿Revocar la invitación ${index + 1}?`,
      description: 'Este código dejará de permitir nuevas entradas al grupo.',
      confirmLabel: 'Sí, revocar invitación', busy,
      run: () => actions.revokeInvitation(group.id, invitation.id),
    }) : null);
}

export function renderGroupDetails({ group, members, invitations, busy }, actions) {
  const invite = pendingFieldset(busy, 'Crear una invitación');
  if (group.permissions.canInvite) invite.fieldset.append(button('Crear invitación', () => {
    void invite.run(() => actions.createInvitation(group.id));
  }, { variant: 'primary' }));
  return el('section', { className: 'view group-detail', 'aria-label': `Grupo ${group.name}` },
    el('header', { className: 'view-heading' },
      el('p', { className: 'eyebrow' }, 'Tu grupo'), el('h1', {}, group.name),
      el('div', { className: 'group-detail__meta' }, roleTag(group), el('span', {}, memberCount(group.memberCount)))),
    group.tournamentId === null ? notice('El grupo aún no tiene un torneo configurado. Mientras tanto, podéis ir reuniendo al equipo.') : null,
    el('section', { className: 'group-roster', 'aria-label': 'Personas del grupo' },
      el('header', { className: 'section-heading' }, el('h2', {}, 'La gente del grupo')),
      members.length ? el('ul', { className: 'member-list' }, members.map(member => el('li', { className: 'member-row' },
        el('strong', {}, member.displayName),
        el('span', { className: 'muted' }, 'Se unió el ', el('time', { datetime: member.joinedAt }, formatDate(member.joinedAt))))))
        : el('p', { className: 'muted' }, 'La lista de miembros está vacía.')),
    el('section', { className: 'group-invitations', 'aria-label': 'Invitaciones del grupo' },
      el('header', { className: 'section-heading' }, el('div', {}, el('h2', {}, 'Invitaciones'),
        el('p', { className: 'muted' }, 'Comparte los códigos solo con las personas que quieras en el grupo.')),
      group.permissions.canInvite ? invite.fieldset : null),
      invitations.length ? el('ul', { className: 'invitation-list' }, invitations.map((invitation, index) => invitationCard(group, invitation, index, busy, actions)))
        : el('p', { className: 'muted' }, 'Todavía no hay invitaciones en esta vista.'),
      !group.permissions.canInvite ? el('p', { className: 'muted' }, 'No tienes permiso para gestionar invitaciones en este grupo.') : null),
    group.permissions.canLeave ? el('section', { className: 'group-leave', 'aria-label': 'Salir del grupo' },
      el('h2', {}, 'Salir del grupo'),
      confirmation({ label: 'Salir del grupo', title: `¿Salir de «${group.name}»?`,
        description: 'Confirma que quieres dejar de formar parte de este grupo.', confirmLabel: 'Sí, salir del grupo',
        busy, run: () => actions.leaveGroup(group.id) })) : null);
}
