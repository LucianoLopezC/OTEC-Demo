<?php
// ════════════════════════════════════════════════════════════════════════════
// preview_temp.php — Almacén temporal de .docx para previsualización
// POST   /api/preview_temp.php   → guarda el archivo, retorna URL pública
// DELETE /api/preview_temp.php   → elimina el archivo temporal del usuario
//
// El archivo se guarda como "preview_{userId}.docx" en uploads/previews/
// (un solo archivo por usuario — sobrescribe el anterior automáticamente).
// La carpeta uploads/previews/ tiene su propio .htaccess que permite acceso
// público, necesario para que el visor de Microsoft Office Online lo cargue.
// ════════════════════════════════════════════════════════════════════════════

require_once __DIR__ . '/helpers.php';
cors_headers();
$user = auth_required();

$method     = $_SERVER['REQUEST_METHOD'];
$previewDir = UPLOAD_DIR . 'previews/';

if (!is_dir($previewDir)) mkdir($previewDir, 0755, true);

// Crear .htaccess si no existe — necesario para acceso público sin autenticación
$htaccess = $previewDir . '.htaccess';
if (!file_exists($htaccess)) {
    file_put_contents($htaccess,
        "Require all granted\n" .
        "Options -Indexes\n" .
        "<FilesMatch \"\\.(php|php3|php4|php5|phtml|pl|py|jsp|asp|sh|cgi)$\">\n" .
        "  Require all denied\n" .
        "</FilesMatch>\n"
    );
}

// Limpiar archivos del mismo usuario (token anterior) y archivos viejos (+1h)
foreach (glob($previewDir . '*.docx') ?: [] as $f) {
    $esDeEsteUser = strpos(basename($f), 'prev_' . $user['id'] . '_') === 0;
    $esViejo      = (time() - filemtime($f)) > 3600;
    if ($esDeEsteUser || $esViejo) unlink($f);
}

$token    = bin2hex(random_bytes(16)); // URL no adivinable
$filename = 'prev_' . $user['id'] . '_' . $token . '.docx';
$filepath = $previewDir . $filename;

// ─── DELETE: eliminar archivos temporales del usuario ────────────────────────
if ($method === 'DELETE') {
    foreach (glob($previewDir . 'prev_' . $user['id'] . '_*.docx') ?: [] as $f) unlink($f);
    json_response(['ok' => true]);
}

// ─── POST: guardar archivo temporal ───────────────────────────────────────────
if ($method === 'POST') {
    if (empty($_FILES['file'])) json_error('No se recibió ningún archivo');

    $file = $_FILES['file'];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        json_error('Error al recibir el archivo (código ' . $file['error'] . ')');
    }

    $ext = strtolower(pathinfo($file['name'] ?? 'file.docx', PATHINFO_EXTENSION));
    if ($ext !== 'docx') json_error('Solo se permiten archivos .docx');

    $finfo    = finfo_open(FILEINFO_MIME_TYPE);
    $realMime = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    $allowedMimes = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/zip',
        'application/octet-stream',
    ];
    if (!in_array($realMime, $allowedMimes, true)) {
        json_error('El contenido del archivo no corresponde a un .docx válido');
    }

    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        json_error('Error al guardar el archivo temporal', 500);
    }

    // Retornar solo el nombre — el frontend construye la URL pública
    // usando VITE_API_URL para saber el dominio correcto
    json_response([
        'ok'       => true,
        'filename' => $filename,
    ]);
}

json_error('Método no permitido', 405);
