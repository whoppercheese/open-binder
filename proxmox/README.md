# OpenBinder on Proxmox VE

Self-hosted [OpenBinder](https://github.com/whoppercheese/open-binder) in an unprivileged Debian 13 LXC with Docker Compose. All scripts are loaded from this repository — no dependency on [community-scripts/ProxmoxVE](https://github.com/community-scripts/ProxmoxVE).

## Requirements

- Proxmox VE 8.x or 9.x
- Root shell on the Proxmox host
- Outbound internet (GitHub, Docker, TCGdex during catalog sync)

## One-liner (install)

On the Proxmox host as **root**:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/whoppercheese/open-binder/main/proxmox/install.sh)"
```

Creates an LXC named `openbinder`, installs Docker, clones the repo to `/opt/open-binder`, and runs `./scripts/deploy.sh`.

After install:

- App: `http://<container-ip>:3000`
- Postgres credentials: `pct enter <CTID>` → `cat ~/openbinder.creds`

## Update

Inside the container as **root** (e.g. `pct enter <CTID>`):

```bash
update
```

That runs apt/Docker upgrades and `./scripts/deploy.sh` (git pull + rebuild).

From the Proxmox host without entering the shell:

```bash
pct exec <CTID> -- update
```

For app-only changes (skip OS/Docker upgrades):

```bash
cd /opt/open-binder && ./scripts/deploy.sh
```

## Default LXC resources

| Variable | Default |
| --- | --- |
| `OPENBINDER_CPU` | 1 |
| `OPENBINDER_RAM` | 2048 (MiB) |
| `OPENBINDER_DISK` | 32 (GB) |
| `OPENBINDER_BRIDGE` | vmbr0 |
| `OPENBINDER_HOSTNAME` | openbinder |

Example with more resources:

```bash
OPENBINDER_CPU=2 OPENBINDER_RAM=4096 OPENBINDER_DISK=48 bash -c "$(curl -fsSL https://raw.githubusercontent.com/whoppercheese/open-binder/main/proxmox/install.sh)"
```

Optional:

| Variable | Purpose |
| --- | --- |
| `OPENBINDER_CTID` | Fixed container ID (install) or target ID (update) |
| `OPENBINDER_STORAGE` | Storage ID for rootfs and template |
| `OPENBINDER_PASSWORD` | Optional root password for SSH (console uses `cmode shell`, no login prompt) |
| `OPENBINDER_VERBOSE=yes` | Show command output during install/update |
| `OPENBINDER_GITHUB_REPO` | Fork override (`owner/repo`) |
| `OPENBINDER_GITHUB_BRANCH` | Branch override (default `main`) |

## Scripts

| File | Runs on | Purpose |
| --- | --- | --- |
| `proxmox/install.sh` | Proxmox host | Create LXC or trigger update |
| `proxmox/install/openbinder-install.sh` | LXC | Docker, clone, `.env`, first deploy |
| `proxmox/install/openbinder-update.sh` | LXC | apt + Docker upgrade + `deploy.sh` (also installed as `/usr/bin/update`) |

## Stack

- Docker Engine via [get.docker.com](https://get.docker.com) — no Portainer, no Docker TCP socket on port 2375
- Services: `postgres`, `migrate`, `app`, `worker` via `docker compose`
- Volumes: `postgres_data`, `image_storage`

## Troubleshooting

**Proxmox console asks for a password:** New installs use `cmode shell` (no login prompt, like helper-script LXCs). For an existing container: `pct set <CTID> -cmode shell` on the Proxmox host. Host access without a password: `pct enter <CTID>`.

**Docker in unprivileged LXC:** Nesting and keyctl are enabled automatically. If containers fail to start after a Docker upgrade, see [ProxmoxVE #8967](https://github.com/community-scripts/ProxmoxVE/issues/8967) (AppArmor / `ip_unprivileged_port_start`).

**Low memory during install:** The first `docker compose up --build` needs enough RAM for the Node.js build. Increase `OPENBINDER_RAM` or run `./scripts/deploy.sh` again inside the CT after resizing.

**Script 404:** Push the `proxmox/` folder to GitHub on branch `main` before using the one-liner.
