<?php
// ════════════════════════════════════════════════════════════════════════════
// backup_cron.php — Backup diario automático de la BD
// Ejecutar via cron job en el panel del hosting:
//   curl https://tu-sitio.infinityfreeapp.com/api/backup_cron.php?token=TU_TOKEN
// ════════════════════════════════════════════════════════════════════════════

require_once __DIR__ . '/config.php';

// ─── Verificar token de seguridad ─────────────────────────────────────────────
$token = $_GET['token'] ?? '';

$placeholders = ['otec_demo_backup_CAMBIAR', 'otec_demo_backup2_CAMBIAR'];
if (!defined('BACKUP_TOKEN') || in_array(BACKUP_TOKEN, $placeholders, true)) {
    http_response_code(500);
    die(json_encode(['error' => 'BACKUP_TOKEN no ha sido configurado. Ver config.php']));
}
if (!hash_equals(BACKUP_TOKEN, $token)) {
    http_response_code(403);
    die(json_encode(['error' => 'Forbidden']));
}

// ─── Carpeta de backups (fuera de acceso web directo) ─────────────────────────
$backup_dir = __DIR__ . '/../backups/';
if (!is_dir($backup_dir)) mkdir($backup_dir, 0755, true);

// ─── Conectar a MySQL ─────────────────────────────────────────────────────────
try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
} catch (PDOException $e) {
    http_response_code(500);
    die(json_encode(['error' => 'DB Error: ' . $e->getMessage()]));
}

// ─── Generar SQL ──────────────────────────────────────────────────────────────
$tablas = ['roles', 'empresas', 'usuarios', 'personas', 'plantillas', 'cursos', 'certificados', 'lotes_certificados'];

$sql  = "-- ════════════════════════════════════════════\n";
$sql .= "-- OTEC Demo — Backup automatico\n";
$sql .= "-- Fecha:  " . date('Y-m-d H:i:s') . "\n";
$sql .= "-- Base de datos: " . DB_NAME . "\n";
$sql .= "-- ════════════════════════════════════════════\n\n";
$sql .= "SET NAMES utf8mb4;\nSET foreign_key_checks = 0;\n\n";

foreach ($tablas as $tabla) {
    // Estructura
    $stmt = $pdo->query("SHOW CREATE TABLE `$tabla`");
    $row  = $stmt->fetch(PDO::FETCH_NUM);
    $sql .= "-- ─── $tabla ───\n";
    $sql .= "DROP TABLE IF EXISTS `$tabla`;\n" . $row[1] . ";\n\n";

    // Datos
    $rows = $pdo->query("SELECT * FROM `$tabla`")->fetchAll();
    if (!empty($rows)) {
        $cols    = '`' . implode('`, `', array_keys($rows[0])) . '`';
        $inserts = [];
        foreach ($rows as $r) {
            $vals = array_map(fn($v) => $v === null ? 'NULL' : $pdo->quote($v), array_values($r));
            $inserts[] = '(' . implode(', ', $vals) . ')';
        }
        $sql .= "INSERT INTO `$tabla` ($cols) VALUES\n" . implode(",\n", $inserts) . ";\n\n";
    }
}

$sql .= "SET foreign_key_checks = 1;\n";

// ─── Guardar archivo ──────────────────────────────────────────────────────────
$filename = 'backup-' . DB_NAME . '-' . date('Y-m-d') . '.sql';
$filepath = $backup_dir . $filename;
file_put_contents($filepath, $sql);

// ─── Mantener solo los últimos 14 backups ─────────────────────────────────────
$archivos = glob($backup_dir . 'backup-' . DB_NAME . '-*.sql');
if (count($archivos) > 14) {
    sort($archivos); // más antiguos primero
    foreach (array_slice($archivos, 0, count($archivos) - 14) as $viejo) {
        unlink($viejo);
    }
}

// ─── Respuesta ────────────────────────────────────────────────────────────────
echo json_encode([
    'ok'      => true,
    'archivo' => $filename,
    'size_kb' => round(filesize($filepath) / 1024, 1),
    'fecha'   => date('Y-m-d H:i:s'),
    'tablas'  => $tablas,
]);
