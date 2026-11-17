#!/bin/bash
# Fake privileged helper for local development (no root, no ufw/nginx/certbot needed):
#   PRIVILEGED_HELPER=dev/fake-helper.sh PRIVILEGED_HELPER_SUDO=false npm run dev
# Simulates the sub-commands of deploy/admin-panel-helper the panel reads or changes; ufw rules are
# kept in a temporary file, reset with `rm "${TMPDIR:-/tmp}/admin-panel-fake-ufw"`.
set -euo pipefail

STATE=${TMPDIR:-/tmp}/admin-panel-fake-ufw
if [[ ! -f $STATE ]]; then
    printf '%s\n' '22/tcp|ALLOW IN|Anywhere' '80,443/tcp|ALLOW IN|Anywhere' '5432/tcp|ALLOW IN|10.0.0.0/24' \
        '22/tcp (v6)|ALLOW IN|Anywhere (v6)' '80,443/tcp (v6)|ALLOW IN|Anywhere (v6)' > "$STATE"
fi

die() { echo "admin-panel-helper: $*" >&2; exit 2; }

print_rules() {
    local n=0 to action from
    while IFS='|' read -r to action from; do
        n=$((n + 1))
        printf '[%2d] %-26s %-11s %s\n' "$n" "$to" "$action" "$from"
    done < "$STATE"
}

case ${1:-} in
    nginx-status) echo active ;;
    nginx-start | nginx-stop | nginx-reload | nginx-test | vhost-enable | vhost-disable | vhost-delete) ;;
    vhost-write) cat > /dev/null ;;
    cert-list)
        cat <<'OUT'
Found the following certs:
  Certificate Name: dvachette.fr
    Domains: dvachette.fr *.dvachette.fr
    Expiry Date: 2027-02-14 10:00:00+00:00 (VALID: 89 days)
OUT
        ;;
    ufw-status)
        printf 'Status: active\nLogging: on (low)\nDefault: deny (incoming), allow (outgoing), disabled (routed)\nNew profiles: skip\n\n'
        printf '%-26s %-11s %s\n' To Action From -- ------ ----
        sed 's/|/  /g' "$STATE"
        ;;
    ufw-rules)
        printf 'Status: active\n\n     %-26s %-11s %s\n     %-26s %-11s %s\n' To Action From -- ------ ----
        print_rules
        ;;
    ufw-allow | ufw-deny)
        [[ ${2:-} =~ ^[0-9]+$ && ${3:-} =~ ^(tcp|udp)$ ]] || die "invalid rule"
        [[ $1 == ufw-deny && $2 == 22 ]] && die "refusing to deny port 22: it could lock SSH out (do it over SSH)"
        action=$([[ $1 == ufw-allow ]] && echo "ALLOW IN" || echo "DENY IN")
        if [[ -n ${4:-} ]]; then
            echo "$2/$3|$action|$4" >> "$STATE"
        else
            echo "$2/$3|$action|Anywhere" >> "$STATE"
            echo "$2/$3 (v6)|$action|Anywhere (v6)" >> "$STATE"
        fi
        echo "Rule added"
        ;;
    ufw-delete)
        [[ ${2:-} =~ ^[0-9]+$ ]] || die "invalid rule number"
        line=$(sed -n "${2}p" "$STATE")
        [[ -n $line ]] || die "no ufw rule #$2"
        [[ $line =~ (^|[^0-9])22/tcp ]] && die "refusing to delete an SSH rule from the panel (do it over SSH): $line"
        sed -i "${2}d" "$STATE"
        echo "Rule deleted"
        ;;
    *) die "fake helper: unsupported command ${1:-}" ;;
esac
