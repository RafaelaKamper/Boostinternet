<?php
// api/save_registration.php
declare(strict_types=1);

// --- CORS & Preflight (robust, auch same-origin) ---
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: ' . $origin);
header('Vary: Origin');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Preflight beantworten (KEIN 405!)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204); // No Content
  exit;
}

// --- Fehler ins Log, nicht ins Output ---
error_reporting(E_ALL);
ini_set('display_errors', '0');
set_error_handler(function($severity, $message, $file, $line){
  throw new ErrorException($message, 0, $severity, $file, $line);
});

function respond(int $code, array $data): void {
  http_response_code($code);
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

try {
  if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['ok'=>false,'error'=>'Method not allowed']);
  }

  // Payload lesen: JSON ODER x-www-form-urlencoded
  $ctype = $_SERVER['CONTENT_TYPE'] ?? '';
  $raw   = file_get_contents('php://input') ?: '';

  if (stripos($ctype, 'application/json') !== false) {
    $data = json_decode($raw, true);
  } elseif (stripos($ctype, 'application/x-www-form-urlencoded') !== false) {
    parse_str($raw, $data);
  } else {
    // Fallback: versuche JSON
    $data = json_decode($raw, true);
    if (!is_array($data)) {
      // und dann Form
      parse_str($raw, $data);
    }
  }

  if (!is_array($data)) {
    respond(400, ['ok'=>false,'error'=>'Invalid or empty body']);
  }

  // Pflichtfelder
  $required = ['vorname','nachname','schule','schulform','klasse'];
  foreach ($required as $key) {
    if (!isset($data[$key]) || trim((string)$data[$key]) === '') {
      respond(400, ['ok'=>false,'error'=>"Feld '$key' fehlt"]);
    }
  }

  // Bereinigen
  $clean = fn($s) => mb_substr(trim((string)$s), 0, 200);
  $entry = [
    'vorname'   => $clean($data['vorname']),
    'nachname'  => $clean($data['nachname']),
    'schule'    => $clean($data['schule']),
    'schulform' => $clean($data['schulform']),
    'klasse'    => $clean($data['klasse']),
    'timestamp' => date('c'),
    'ip'        => $_SERVER['REMOTE_ADDR'] ?? null
  ];

  // Ziel: /data/registrations.json
  $file = __DIR__ . '/../data/registrations.json';

  if (!file_exists($file)) {
    $dir = dirname($file);
    if (!is_dir($dir) && !mkdir($dir, 0775, true)) {
      respond(500, ['ok'=>false,'error'=>'Kann data-Verzeichnis nicht anlegen']);
    }
    file_put_contents($file, "[]", LOCK_EX);
  }

  $existing = file_get_contents($file);
  $list = json_decode($existing, true);
  if (!is_array($list)) $list = [];

  $list[] = $entry;

  $ok = file_put_contents(
    $file,
    json_encode($list, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
    LOCK_EX
  );

  if ($ok === false) {
    respond(500, ['ok'=>false,'error'=>'Fehler beim Schreiben der Datei']);
  }

  respond(200, ['ok'=>true]);
}
catch (Throwable $e) {
  error_log('[save_registration] '.$e->getMessage().' @ '.$e->getFile().':'.$e->getLine());
  respond(500, ['ok'=>false,'error'=>'Unerwarteter Serverfehler']);
}

