# Database migrations

Create reviewed migrations with:

```bash
npm run prisma:migrate -- --name <migration-name>
```

`DATABASE_URL` is used by the application and `DIRECT_URL` is used for schema migrations. Never run development migrations against production.
