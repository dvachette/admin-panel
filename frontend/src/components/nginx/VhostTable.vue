<script setup lang="ts">
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import ConfirmDialog from 'primevue/confirmdialog'
import { useConfirm } from 'primevue/useconfirm'
import { coversDomain, type Certificate, type Vhost } from '@/types/nginxTypes'

const props = defineProps<{
  vhosts: Vhost[]
  loading: boolean
  certificates: Certificate[]
  /** Name of the vhost certbot is currently running for */
  securing: string | null
}>()

const emit = defineEmits<{
  enable: [name: string]
  disable: [name: string]
  delete: [name: string]
  edit: [vhost: Vhost]
  secure: [name: string]
}>()

type Severity = 'success' | 'warn' | 'danger' | 'info'

interface CertStatus {
  label: string
  severity: Severity
  tooltip: string
}

const RENEW_WARNING_DAYS = 20

/** State of the certificate an SSL vhost points to */
function certStatus(vhost: Vhost): CertStatus | null {
  if (!vhost.ssl) return null
  const cert = props.certificates.find((c) => c.name === vhost.certName)
  if (!cert) {
    return { label: 'SSL', severity: 'info', tooltip: vhost.certName ? `Certificat ${vhost.certName} inconnu de certbot` : 'Certificat hors Let\'s Encrypt' }
  }
  const uncovered = vhost.serverNames.filter((d) => d !== '_' && !coversDomain(cert, d))
  if (uncovered.length > 0) {
    return { label: 'SSL ≠ domaine', severity: 'danger', tooltip: `${cert.name} ne couvre pas ${uncovered.join(', ')}` }
  }
  const expiry = cert.expiry ? new Date(cert.expiry).toLocaleDateString('fr-FR') : '?'
  if (!cert.valid || (cert.daysLeft ?? 0) < 0) {
    return { label: 'SSL expiré', severity: 'danger', tooltip: `${cert.name} a expiré le ${expiry}` }
  }
  return {
    label: `SSL · ${cert.daysLeft} j`,
    severity: (cert.daysLeft ?? 0) < RENEW_WARNING_DAYS ? 'warn' : 'success',
    tooltip: `${cert.name} (${cert.domains.join(', ')}), expire le ${expiry}`,
  }
}

function canSecure(vhost: Vhost): boolean {
  return vhost.enabled && !vhost.parseError && vhost.serverNames.some((d) => d.includes('.'))
}

function confirmSecure(vhost: Vhost) {
  confirm.require({
    group: 'vhost-certificate',
    message: vhost.ssl
      ? `Réinstaller un certificat sur "${vhost.name}" avec certbot ? Utile après un changement de domaine.`
      : `Passer "${vhost.name}" en HTTPS avec certbot ? Un bloc 443 et la redirection HTTP → HTTPS seront ajoutés au fichier.`,
    header: 'Certificat',
    icon: 'pi pi-lock',
    acceptLabel: 'Lancer certbot',
    rejectLabel: 'Annuler',
    accept: () => emit('secure', vhost.name),
  })
}

const confirm = useConfirm()
function listenLabel(vhost: Vhost): string {
  return vhost.listenPorts.join(', ')
}

function proxyLabel(vhost: Vhost): string {
  return vhost.proxyPorts.length > 0 ? vhost.proxyPorts.join(', ') : vhost.proxyTargets.join(', ')
}
function confirmDelete(name: string) {
  confirm.require({
    message: `Supprimer le vhost "${name}" ?`,
    header: 'Confirmation',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: 'Supprimer',
    rejectLabel: 'Annuler',
    accept: () => emit('delete', name),
  })
}
</script>

<template>
  <ConfirmDialog />
  <ConfirmDialog group="vhost-certificate" />
  <DataTable :value="vhosts" :loading="loading" stripedRows>
    <Column field="name" header="Nom" />
    <Column header="État">
      <template #body="{ data }">
        <Tag
          :value="data.enabled ? 'activé' : 'désactivé'"
          :severity="data.enabled ? 'success' : 'secondary'"
        />
      </template>
    </Column>
    <Column header="Écoute">
  <template #body="{ data }">
    <Tag v-if="data.parseError" value="illisible" severity="danger" />
    <template v-else>
      {{ listenLabel(data) }}
      <Tag
        v-if="certStatus(data)"
        v-tooltip.top="certStatus(data)!.tooltip"
        :value="certStatus(data)!.label"
        :severity="certStatus(data)!.severity"
      />
    </template>
  </template>
</Column>
<Column header="Cible">
  <template #body="{ data }">
    <template v-if="data.parseError">-</template>
    <template v-else-if="data.proxyTargets.length > 0">{{ proxyLabel(data) }}</template>
    <template v-else>{{ data.root ?? '-' }}</template>
  </template>
</Column>
    <Column header="Actions">
      <template #body="{ data }">
        <div class="actions">
          <Button
            v-if="!data.enabled"
            icon="pi pi-check"
            size="small"
            severity="success"
            text
            tooltip="Activer"
            @click="emit('enable', data.name)"
          />
          <Button
            v-else
            icon="pi pi-times"
            size="small"
            severity="warning"
            text
            tooltip="Désactiver"
            @click="emit('disable', data.name)"
          />
          <Button
            icon="pi pi-pencil"
            size="small"
            text
            tooltip="Modifier"
            @click="emit('edit', data)"
          />
          <!-- wrapper: a disabled button does not trigger its tooltip -->
          <span v-tooltip.top="canSecure(data) ? 'Certificat (certbot)' : 'Activez le vhost pour installer un certificat'">
          <Button
            :icon="data.ssl ? 'pi pi-lock' : 'pi pi-lock-open'"
            size="small"
            text
            :severity="data.ssl ? 'info' : 'secondary'"
            :disabled="!canSecure(data) || securing !== null"
            :loading="securing === data.name"
            @click="confirmSecure(data)"
          />
          </span>
          <Button
            icon="pi pi-trash"
            size="small"
            severity="danger"
            text
            @click="confirmDelete(data.name)"
          />
        </div>
      </template>
    </Column>
  </DataTable>
</template>

<style scoped>
.actions {
  display: flex;
  gap: 0.25rem;
}
</style>
