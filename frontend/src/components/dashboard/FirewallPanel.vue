<script setup lang="ts">
import { ref, computed } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import ConfirmDialog from 'primevue/confirmdialog'
import { useConfirm } from 'primevue/useconfirm'
import {
  groupRules,
  isSshRule,
  type FirewallStatus,
  type NewRule,
  type RuleGroup,
} from '@/types/systemTypes'

const props = defineProps<{
  firewall: FirewallStatus | null
  error: string | null
  busy: boolean
}>()

const emit = defineEmits<{
  add: [rule: NewRule]
  delete: [group: RuleGroup]
}>()

const confirm = useConfirm()

const groups = computed<RuleGroup[]>(() => groupRules(props.firewall?.rules ?? []))
const hasComments = computed(() => groups.value.some((g) => g.comment))

const ACTIONS = [
  { label: 'Autoriser', value: 'allow' },
  { label: 'Bloquer', value: 'deny' },
]
const PROTOS = ['tcp', 'udp']

const form = ref<{ action: 'allow' | 'deny'; port: number | null; proto: 'tcp' | 'udp'; source: string }>({
  action: 'allow',
  port: null,
  proto: 'tcp',
  source: '',
})

const formValid = computed(
  () => form.value.port !== null && form.value.port >= 1 && form.value.port <= 65535,
)
const denySsh = computed(() => form.value.action === 'deny' && form.value.port === 22)

function actionSeverity(action: string): 'success' | 'danger' | 'warn' | 'info' {
  if (action.startsWith('ALLOW')) return 'success'
  if (action.startsWith('LIMIT')) return 'info'
  if (action.startsWith('REJECT')) return 'warn'
  return 'danger'
}

const ACTION_LABELS: Record<string, string> = {
  ALLOW: 'Autorisé',
  DENY: 'Bloqué',
  REJECT: 'Rejeté',
  LIMIT: 'Limité',
}

function actionLabel(action: string): string {
  const [verb, direction] = action.split(' ')
  const label = ACTION_LABELS[verb!] ?? verb!
  return direction && direction !== 'IN' ? `${label} (${direction === 'OUT' ? 'sortant' : 'routé'})` : label
}

function policySeverity(policy: string): 'success' | 'warn' | 'danger' | 'secondary' {
  if (policy === 'deny' || policy === 'reject') return 'success'
  if (policy === 'allow') return 'warn'
  return 'secondary'
}

function submit() {
  if (!formValid.value || denySsh.value) return
  const rule: NewRule = {
    action: form.value.action,
    port: form.value.port!,
    proto: form.value.proto,
  }
  if (form.value.source.trim()) rule.source = form.value.source.trim()
  emit('add', rule)
  form.value.port = null
  form.value.source = ''
}

function confirmDelete(group: RuleGroup) {
  confirm.require({
    group: 'firewall',
    message: `Supprimer la règle « ${group.to} ${actionLabel(group.action)} depuis ${group.from} » ${
      group.v4 && group.v6 ? '(IPv4 et IPv6) ' : ''
    }?`,
    header: 'Pare-feu',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: 'Supprimer',
    rejectLabel: 'Annuler',
    accept: () => emit('delete', group),
  })
}
</script>

<template>
  <ConfirmDialog group="firewall" />
  <Message v-if="error" severity="warn" :closable="false">{{ error }}</Message>
  <template v-else-if="firewall">
    <Message v-if="!firewall.active" severity="error" :closable="false">
      ufw est inactif : tous les ports en écoute sont joignables. Activez-le en SSH après avoir
      autorisé SSH (<code>sudo ufw allow OpenSSH && sudo ufw enable</code>).
    </Message>
    <template v-else>
      <div class="policies">
        <span>Entrant <Tag :value="firewall.defaults?.incoming ?? '?'" :severity="policySeverity(firewall.defaults?.incoming ?? '')" /></span>
        <span>Sortant <Tag :value="firewall.defaults?.outgoing ?? '?'" severity="secondary" /></span>
        <span>Routé <Tag :value="firewall.defaults?.routed ?? '?'" severity="secondary" /></span>
        <span v-if="firewall.logging" class="text-muted">Logs : {{ firewall.logging }}</span>
      </div>

      <div class="table-scroll">
      <DataTable :value="groups" data-key="key" size="small" striped-rows>
        <Column header="Destination">
          <template #body="{ data }">
            <span class="mono">{{ data.to }}</span>
          </template>
        </Column>
        <Column header="Action">
          <template #body="{ data }">
            <Tag :value="actionLabel(data.action)" :severity="actionSeverity(data.action)" />
          </template>
        </Column>
        <Column header="Source">
          <template #body="{ data }">
            <span class="mono">{{ data.from === 'Anywhere' ? 'Partout' : data.from }}</span>
          </template>
        </Column>
        <Column header="IP">
          <template #body="{ data }">
            <div class="tags">
              <Tag v-if="data.v4" value="IPv4" severity="secondary" />
              <Tag v-if="data.v6" value="IPv6" severity="secondary" />
            </div>
          </template>
        </Column>
        <Column v-if="hasComments" field="comment" header="Commentaire">
          <template #body="{ data }">
            <span class="text-muted">{{ data.comment ?? '' }}</span>
          </template>
        </Column>
        <Column header="" style="width: 3rem">
          <template #body="{ data }">
            <span
              v-tooltip.top="isSshRule(data.to) ? 'Règle SSH : à modifier en SSH, pour ne pas perdre l’accès' : 'Supprimer'"
            >
              <Button
                icon="pi pi-trash"
                size="small"
                severity="danger"
                text
                :disabled="isSshRule(data.to) || busy"
                @click="confirmDelete(data)"
              />
            </span>
          </template>
        </Column>
      </DataTable>
      </div>

      <form class="add-rule" @submit.prevent="submit">
        <Select v-model="form.action" :options="ACTIONS" option-label="label" option-value="value" size="small" />
        <InputNumber
          v-model="form.port"
          placeholder="Port"
          :use-grouping="false"
          :min="1"
          :max="65535"
          size="small"
          input-class="port-input"
        />
        <SelectButton v-model="form.proto" :options="PROTOS" :allow-empty="false" size="small" />
        <InputText v-model="form.source" placeholder="Source : partout, ou IP / CIDR" size="small" class="source" />
        <Button
          type="submit"
          label="Ajouter"
          icon="pi pi-plus"
          size="small"
          :disabled="!formValid || denySsh || busy"
          :loading="busy"
        />
      </form>
      <small v-if="denySsh" class="warn">Bloquer le port 22 couperait l’accès SSH : refusé depuis le panel.</small>
    </template>
  </template>
</template>

<style scoped>
.policies {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1.25rem;
  margin-bottom: 0.75rem;
}

.policies span {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.tags {
  display: flex;
  gap: 0.25rem;
}

.table-scroll {
  overflow-x: auto;
}

.add-rule {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.75rem;
}

.add-rule :deep(.port-input) {
  width: 6rem;
}

.source {
  flex: 1;
  min-width: 12rem;
}

.mono {
  font-family: ui-monospace, monospace;
  font-size: 0.85rem;
}

.text-muted {
  color: var(--p-surface-400);
}

.warn {
  color: var(--p-orange-400);
}
</style>
