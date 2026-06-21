/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable(
    'auth_tokens',
    {
      token_hash: { type: 'text', primaryKey: true },
      account_id: {
        type: 'text',
        notNull: true,
        references: 'accounts(id)',
        onDelete: 'CASCADE',
      },
      kind: { type: 'text', notNull: true },
      expires_at: { type: 'timestamptz', notNull: true },
      created_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('NOW()'),
      },
    },
    { ifNotExists: true },
  );

  pgm.createIndex('auth_tokens', 'account_id', {
    name: 'auth_tokens_account_id_idx',
    ifNotExists: true,
  });
  pgm.createIndex('auth_tokens', 'expires_at', {
    name: 'auth_tokens_expires_at_idx',
    ifNotExists: true,
  });
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable('auth_tokens', { ifExists: true, cascade: true });
};
