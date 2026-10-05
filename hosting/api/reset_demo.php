<?php
// ════════════════════════════════════════════════════════════════════════════
// reset_demo.php — Restablece los datos de ejemplo de la demo pública
// Pensado para ser llamado una vez al día por un workflow programado (cron):
//   GET /api/reset_demo.php?token=TU_TOKEN
// ════════════════════════════════════════════════════════════════════════════

require_once __DIR__ . '/helpers.php';

// ─── Verificar token de seguridad ─────────────────────────────────────────────
$token = $_GET['token'] ?? '';
$placeholders = ['cambia-esta-reset-key-por-una-propia'];
if (!defined('RESET_TOKEN') || RESET_TOKEN === '' || in_array(RESET_TOKEN, $placeholders, true)) {
    json_error('RESET_TOKEN no ha sido configurado. Ver config.php', 500);
}
if (!hash_equals(RESET_TOKEN, $token)) {
    json_error('Forbidden', 403);
}

$pdo = get_pdo();

try {
    demo_restablecer_datos($pdo);
} catch (PDOException $e) {
    json_error('Error al restablecer los datos: ' . $e->getMessage(), 500);
}

json_response(['ok' => true, 'mensaje' => 'Datos de demo restablecidos', 'fecha' => date('Y-m-d H:i:s')]);
