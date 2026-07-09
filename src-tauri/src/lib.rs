use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::time::Duration;
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
struct DesktopEnvironment {
    app_data_dir: String,
    model_dir: String,
    model_state_file: String,
    runtime: String,
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| format!("Unable to resolve app data directory: {error}"))
}

fn read_json_file<T: for<'de> Deserialize<'de>>(path: &PathBuf) -> Result<Option<T>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(path)
        .map_err(|error| format!("Unable to read file: {error}"))?;
    let value = serde_json::from_str(&raw)
        .map_err(|error| format!("Unable to parse file: {error}"))?;
    Ok(Some(value))
}

fn write_json_file<T: Serialize>(path: &PathBuf, value: &T) -> Result<(), String> {
    fs::create_dir_all(path.parent().unwrap_or(path))
        .map_err(|error| format!("Unable to create directory: {error}"))?;
    let raw = serde_json::to_string_pretty(value)
        .map_err(|error| format!("Unable to serialize: {error}"))?;
    fs::write(path, raw)
        .map_err(|error| format!("Unable to write file: {error}"))
}

#[tauri::command]
fn desktop_environment(app: AppHandle) -> Result<DesktopEnvironment, String> {
    let app_data_dir = app_data_dir(&app)?;
    let model_dir = app_data_dir.join("models");
    fs::create_dir_all(&model_dir)
        .map_err(|error| format!("Unable to create model directory: {error}"))?;

    Ok(DesktopEnvironment {
        model_state_file: app_data_dir
            .join("model-state.json")
            .to_string_lossy()
            .to_string(),
        app_data_dir: app_data_dir.to_string_lossy().to_string(),
        model_dir: model_dir.to_string_lossy().to_string(),
        runtime: "tauri-rust".to_string(),
    })
}

#[tauri::command]
fn load_model_state(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let state_file = app_data_dir(&app)?.join("model-state.json");
    read_json_file(&state_file)
}

#[tauri::command]
fn save_model_state(app: AppHandle, state: serde_json::Value) -> Result<(), String> {
    let state_file = app_data_dir(&app)?.join("model-state.json");
    write_json_file(&state_file, &state)
}

#[tauri::command]
fn load_ai_cache(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let cache_file = app_data_dir(&app)?.join("ai-cache.json");
    read_json_file(&cache_file)
}

#[tauri::command]
fn save_ai_cache(app: AppHandle, cache: serde_json::Value) -> Result<(), String> {
    let cache_file = app_data_dir(&app)?.join("ai-cache.json");
    write_json_file(&cache_file, &cache)
}

// ─── AI Settings ───────────────────────────────────────────────────────────────

#[tauri::command]
fn load_ai_settings(app: AppHandle) -> Result<Option<String>, String> {
    let file = app_data_dir(&app)?.join("ai-settings.json");
    if !file.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&file)
        .map_err(|e| format!("Unable to read AI settings: {e}"))?;
    Ok(Some(raw))
}

#[tauri::command]
fn save_ai_settings(app: AppHandle, settings: String) -> Result<(), String> {
    let file = app_data_dir(&app)?.join("ai-settings.json");
    // `settings` is already a JSON string from the frontend — parse then write as object
    let value: serde_json::Value = serde_json::from_str(&settings)
        .map_err(|e| format!("Invalid AI settings JSON: {e}"))?;
    write_json_file(&file, &value)
}

// ─── Courses ─────────────────────────────────────────────────────────────────

#[tauri::command]
fn load_courses(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let file = app_data_dir(&app)?.join("courses.json");
    read_json_file(&file)
}

#[tauri::command]
fn save_courses(app: AppHandle, courses: serde_json::Value) -> Result<(), String> {
    let file = app_data_dir(&app)?.join("courses.json");
    write_json_file(&file, &courses)
}

// ─── Materials ────────────────────────────────────────────────────────────────

#[tauri::command]
fn load_materials(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let file = app_data_dir(&app)?.join("materials.json");
    read_json_file(&file)
}

#[tauri::command]
fn save_materials(app: AppHandle, materials: serde_json::Value) -> Result<(), String> {
    let file = app_data_dir(&app)?.join("materials.json");
    write_json_file(&file, &materials)
}

// ─── Quizzes ─────────────────────────────────────────────────────────────────

#[tauri::command]
fn load_quizzes(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let file = app_data_dir(&app)?.join("quizzes.json");
    read_json_file(&file)
}

#[tauri::command]
fn save_quizzes(app: AppHandle, quizzes: serde_json::Value) -> Result<(), String> {
    let file = app_data_dir(&app)?.join("quizzes.json");
    write_json_file(&file, &quizzes)
}

// ─── Attempts ────────────────────────────────────────────────────────────────

#[tauri::command]
fn load_attempts(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let file = app_data_dir(&app)?.join("attempts.json");
    read_json_file(&file)
}

#[tauri::command]
fn save_attempts(app: AppHandle, attempts: serde_json::Value) -> Result<(), String> {
    let file = app_data_dir(&app)?.join("attempts.json");
    write_json_file(&file, &attempts)
}

// ─── Student Profile ─────────────────────────────────────────────────────────

#[tauri::command]
fn load_student(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let file = app_data_dir(&app)?.join("student.json");
    read_json_file(&file)
}

#[tauri::command]
fn save_student(app: AppHandle, student: serde_json::Value) -> Result<(), String> {
    let file = app_data_dir(&app)?.join("student.json");
    write_json_file(&file, &student)
}

// ─── Teacher Profile ─────────────────────────────────────────────────────────

#[tauri::command]
fn load_teacher(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let file = app_data_dir(&app)?.join("teacher.json");
    read_json_file(&file)
}

#[tauri::command]
fn save_teacher(app: AppHandle, teacher: serde_json::Value) -> Result<(), String> {
    let file = app_data_dir(&app)?.join("teacher.json");
    write_json_file(&file, &teacher)
}

// ─── Practice Sets ───────────────────────────────────────────────────────────

#[tauri::command]
fn load_practice_sets(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let file = app_data_dir(&app)?.join("practice-sets.json");
    read_json_file(&file)
}

#[tauri::command]
fn save_practice_sets(app: AppHandle, practice_sets: serde_json::Value) -> Result<(), String> {
    let file = app_data_dir(&app)?.join("practice-sets.json");
    write_json_file(&file, &practice_sets)
}

// ─── System Logs ─────────────────────────────────────────────────────────────

#[tauri::command]
fn load_system_logs(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let file = app_data_dir(&app)?.join("system-logs.json");
    read_json_file(&file)
}

#[tauri::command]
fn save_system_logs(app: AppHandle, logs: serde_json::Value) -> Result<(), String> {
    let file = app_data_dir(&app)?.join("system-logs.json");
    write_json_file(&file, &logs)
}

// ─── HTTP proxy (bypasses WebView CORS / mixed-content blocks) ────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HttpRequestArgs {
    url: String,
    method: Option<String>,
    headers: Option<HashMap<String, String>>,
    body: Option<String>,
    /// Timeout in ms. 0 = no timeout. Default 120_000.
    timeout_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HttpResponsePayload {
    status: u16,
    ok: bool,
    headers: HashMap<String, String>,
    body: String,
}

fn is_allowed_proxy_url(url: &str) -> Result<(), String> {
    let parsed = reqwest::Url::parse(url).map_err(|e| format!("Invalid URL: {e}"))?;
    let scheme = parsed.scheme();
    if scheme != "http" && scheme != "https" {
        return Err(format!("Blocked URL scheme: {scheme}"));
    }
    let host = parsed
        .host_str()
        .ok_or_else(|| "URL is missing a host".to_string())?
        .to_ascii_lowercase();

    // OpenRouter cloud
    if host == "openrouter.ai" || host.ends_with(".openrouter.ai") {
        return Ok(());
    }

    // Local Ollama (and common LAN loopback aliases)
    if host == "localhost"
        || host == "127.0.0.1"
        || host == "::1"
        || host == "0.0.0.0"
        || host.ends_with(".local")
    {
        return Ok(());
    }

    Err(format!(
        "HTTP proxy blocked host \"{host}\". Allowed: openrouter.ai, localhost/127.0.0.1 (Ollama)."
    ))
}

#[tauri::command]
async fn http_request(request: HttpRequestArgs) -> Result<HttpResponsePayload, String> {
    is_allowed_proxy_url(&request.url)?;

    let method = request
        .method
        .as_deref()
        .unwrap_or("GET")
        .trim()
        .to_ascii_uppercase();
    if method.is_empty() {
        return Err("HTTP method is empty".into());
    }

    let timeout_ms = request.timeout_ms.unwrap_or(120_000);
    let mut client_builder = reqwest::Client::builder()
        .user_agent("LetsDoIT-Classroom/0.1 (Tauri HTTP proxy)")
        .redirect(reqwest::redirect::Policy::limited(5));

    if timeout_ms == 0 {
        client_builder = client_builder.pool_max_idle_per_host(2);
    } else {
        client_builder = client_builder.timeout(Duration::from_millis(timeout_ms));
    }

    let client = client_builder
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {e}"))?;

    let mut builder = client.request(
        reqwest::Method::from_bytes(method.as_bytes())
            .map_err(|e| format!("Invalid HTTP method \"{method}\": {e}"))?,
        &request.url,
    );

    if let Some(headers) = &request.headers {
        for (key, value) in headers {
            // Skip hop-by-hop / forbidden headers that reqwest/browser reject
            let lower = key.to_ascii_lowercase();
            if matches!(
                lower.as_str(),
                "host" | "content-length" | "connection" | "transfer-encoding"
            ) {
                continue;
            }
            builder = builder.header(key.as_str(), value.as_str());
        }
    }

    if let Some(body) = &request.body {
        builder = builder.body(body.clone());
    }

    let response = builder.send().await.map_err(|e| {
        if e.is_timeout() {
            format!("Request timed out talking to {}", request.url)
        } else if e.is_connect() {
            format!("Connection failed for {}: {e}", request.url)
        } else {
            format!("HTTP request failed for {}: {e}", request.url)
        }
    })?;

    let status = response.status().as_u16();
    let ok = response.status().is_success();

    let mut headers = HashMap::new();
    for (key, value) in response.headers().iter() {
        if let Ok(v) = value.to_str() {
            headers.insert(key.to_string(), v.to_string());
        }
    }

    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {e}"))?;

    Ok(HttpResponsePayload {
        status,
        ok,
        headers,
        body,
    })
}

/// Quick connectivity probe (no auth). Used by settings UI diagnostics.
#[tauri::command]
async fn probe_endpoint(url: String) -> Result<HttpResponsePayload, String> {
    http_request(HttpRequestArgs {
        url,
        method: Some("GET".into()),
        headers: None,
        body: None,
        timeout_ms: Some(8_000),
    })
    .await
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            desktop_environment,
            load_model_state,
            save_model_state,
            load_ai_cache,
            save_ai_cache,
            load_ai_settings,
            save_ai_settings,
            load_courses,
            save_courses,
            load_materials,
            save_materials,
            load_quizzes,
            save_quizzes,
            load_attempts,
            save_attempts,
            load_student,
            save_student,
            load_teacher,
            save_teacher,
            load_practice_sets,
            save_practice_sets,
            load_system_logs,
            save_system_logs,
            http_request,
            probe_endpoint,
        ])
        .run(tauri::generate_context!())
        .expect("error while running LetsDoIT desktop app");
}
