<?php
// ════════════════════════════════════════════════════════════════════════════
// download.php — Descarga segura de archivos con autenticación
// GET /api/download.php?path=X&bucket=Y
// ════════════════════════════════════════════════════════════════════════════

require_once __DIR__ . '/helpers.php';
cors_headers();
// window.open() no puede enviar headers — inyectar token del query param antes de validar
if (!empty($_GET['token'])) {
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $_GET['token'];
}
$user = auth_required();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Método no permitido', 405);

$path   = $_GET['path']   ?? '';
$bucket = $_GET['bucket'] ?? '';

$buckets = [
    'plantillas-docx'    => 'plantillas-docx/',
    'certificados-lotes' => 'certificados-lotes/',
    'plantillas'         => 'imagenes/',
];

if (!$path || !isset($buckets[$bucket])) json_error('Parámetros inválidos');

// Sanitizar ruta
$cleanPath = ltrim(str_replace(['../', '..\\', '../'], '', $path), '/\\');
$fullPath  = UPLOAD_DIR . $buckets[$bucket] . $cleanPath;

if (!file_exists($fullPath) || !is_file($fullPath)) {
    json_error('Archivo no encontrado', 404);
}

$ext      = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));
$mimeMap  = [
    'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'zip'  => 'application/zip',
    'pdf'  => 'application/pdf',
    'png'  => 'image/png',
    'jpg'  => 'image/jpeg',
    'jpeg' => 'image/jpeg',
];
$mime     = $mimeMap[$ext] ?? 'application/octet-stream';
$filename = basename($cleanPath);

header('Content-Type: ' . $mime);
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Content-Length: ' . filesize($fullPath));
header('Cache-Control: no-cache, no-store, must-revalidate');
readfile($fullPath);
exit;
