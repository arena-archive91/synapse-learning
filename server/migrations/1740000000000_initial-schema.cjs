/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable(
    'accounts',
    {
      id: { type: 'text', primaryKey: true },
      email: { type: 'text', notNull: true, unique: true },
      plan: { type: 'text', notNull: true, default: 'free' },
      password_hash: { type: 'text', notNull: true },
      salt: { type: 'text', notNull: true },
      stripe_customer_id: { type: 'text' },
      usage: {
        type: 'jsonb',
        notNull: true,
        default: pgm.func(`'{"month":"","requests":0,"promptTokens":0,"completionTokens":0}'::jsonb`),
      },
      created_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('NOW()'),
      },
    },
    { ifNotExists: true },
  );

  pgm.createIndex('accounts', 'stripe_customer_id', {
    name: 'accounts_stripe_customer_id_idx',
    where: 'stripe_customer_id IS NOT NULL',
    ifNotExists: true,
  });

  pgm.createTable(
    'account_libraries',
    {
      account_id: { type: 'text', primaryKey: true },
      payload: { type: 'jsonb', notNull: true },
      updated_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('NOW()'),
      },
    },
    { ifNotExists: true },
  );

  pgm.createTable(
    'account_sessions',
    {
      account_id: { type: 'text', primaryKey: true },
      payload: { type: 'jsonb', notNull: true },
      updated_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('NOW()'),
      },
    },
    { ifNotExists: true },
  );
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable('account_sessions');
  pgm.dropTable('account_libraries');
  pgm.dropTable('accounts', { ifExists: true, cascade: true });
};
