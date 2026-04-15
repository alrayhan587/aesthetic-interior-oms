# Database Backup and Restore

## Backup

Create a compressed PostgreSQL logical backup from `DATABASE_URL`:

```bash
npm run db:backup
```

Optional custom output path:

```bash
npm run db:backup -- backups/db/pre_migration_2026-04-15.dump
```

## Restore

Restore a `.dump` file into a target database URL:

```bash
npm run db:restore -- backups/db/backup_2026-04-15_18-00-00.dump "$RESTORE_DATABASE_URL" --yes
```

Important:
- Restore uses `--clean --if-exists` and will replace objects in the target DB.
- Do not restore directly into production.
- The script has a safety block for your current Neon host (`ep-broad-wind-a1x6mkah.ap-southeast-1.aws.neon.tech`).

## Suggested workflow before migrations

1. Create a backup: `npm run db:backup`
2. Test migration on dev/staging DB first.
3. Keep backup files in secure storage (S3/GCS/etc.), not only local disk.
4. Test restore regularly into a disposable DB.

