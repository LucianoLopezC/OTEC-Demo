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

// Sanitizar ruta — comparar contra el realpath del directorio base en vez de
// filtrar "../" con str_replace (bypasseable con secuencias como "....//")
$cleanPath = ltrim(str_replace('\\', '/', $path), '/');
$baseDir   = UPLOAD_DIR . $buckets[$bucket];
$realBase  = realpath($baseDir);
$realFile  = realpath($baseDir . $cleanPath);

if (!$realBase || !$realFile || !str_starts_with($realFile, $realBase . DIRECTORY_SEPARATOR)) {
    json_error('Archivo no encontrado', 404);
}
$fullPath = $realFile;

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
