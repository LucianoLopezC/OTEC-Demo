<?php
// ════════════════════════════════════════════════════════════════════════════
// config.example.php — Plantilla de configuración
// Copiar este archivo a config.php (mismo directorio) y completar los valores.
// config.php NUNCA se commitea (ver .gitignore).
// ════════════════════════════════════════════════════════════════════════════

// ── Desarrollo local (XAMPP) ──────────────────────────────────────────────────
// define('DB_HOST', 'localhost');
// define('DB_NAME', 'otec_demo_local');
// define('DB_USER', 'root');
// define('DB_PASS', '');
// define('APP_URL', 'http://localhost:5173');

// ── Producción (InfinityFree) ─────────────────────────────────────────────────
// El host de MySQL de InfinityFree NO es "localhost" — es un hostname del tipo
// sqlXXX.infinityfree.com que aparece en el panel de la cuenta, junto con el
// usuario/clave/nombre de la base de datos que tú mismo creas ahí.
define('DB_HOST', 'sqlXXX.infinityfree.com');
define('DB_NAME', 'if0_XXXXXXXX_otec_demo');
define('DB_USER', 'if0_XXXXXXXX');
define('DB_PASS', 'CAMBIAR_ESTA_CLAVE');

define('JWT_SECRET', 'CAMBIAR_por_un_secreto_largo_y_aleatorio');
define('JWT_EXPIRE_SECONDS', 43200); // 12 horas

define('BACKUP_TOKEN', 'CAMBIAR_token_de_backup');
define('SETUP_KEY',   'CAMBIAR_setup_key');
define('RESET_TOKEN', 'cambia-esta-reset-key-por-una-propia'); // usado por reset_demo.php

define('UPLOAD_DIR', __DIR__ . '/../uploads/');
define('APP_URL',    'https://tu-sitio.infinityfreeapp.com');
