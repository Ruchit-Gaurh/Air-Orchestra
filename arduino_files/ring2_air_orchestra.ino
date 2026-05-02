/*
 * Air Orchestra — Ring Firmware v1.1 (Client/Station Mode for Ring 2)
 * ESP32 + MPU6050 → WiFi (STA) → WebSocket → Browser
 */

#include <Wire.h>
#include <WiFi.h>
#include <WebSocketsServer.h>
#include <MPU6050_light.h>
#include <ArduinoJson.h>
#include <ESPmDNS.h>
#include "esp_bt.h"

// ─────────────────────────────────────────────────────────────────
// CONFIG — Station Settings for Ring 2
// ─────────────────────────────────────────────────────────────────
#define RING_ID       "ring2"             // Changed to ring 2
#define AP_SSID       "AirOrchestra_Ring" // The hotspot Ring 1 is creating
#define AP_PASS       "12345678"          // Password for Ring 1's hotspot
#define WS_PORT       81
#define SAMPLE_HZ     60                  // packets per second sent to browser
#define MODE_BTN_PIN  0                 
// ─────────────────────────────────────────────────────────────────

MPU6050 mpu(Wire);
WebSocketsServer webSocket(WS_PORT);

uint32_t lastSendUs    = 0;
uint32_t lastBtnCheck  = 0;
bool     btnPrevState  = HIGH;
uint8_t  ringMode      = 0;            // 0 = drum, 1 = guitar
bool     clientActive  = false;

const uint32_t SEND_INTERVAL_US = 1000000UL / SAMPLE_HZ;

// ─── WebSocket event handler ──────────────────────────────────────
void onWebSocketEvent(uint8_t clientNum, WStype_t type,
                      uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED: {
      IPAddress ip = webSocket.remoteIP(clientNum);
      Serial.printf("[WS] Client #%u connected from %s\n",
                    clientNum, ip.toString().c_str());
      clientActive = true;
      char hello[64];
      snprintf(hello, sizeof(hello),
               "{\"event\":\"hello\",\"ring\":\"%s\",\"mode\":%d}",
               RING_ID, ringMode);
      webSocket.sendTXT(clientNum, hello);
      break;
    }
    case WStype_DISCONNECTED:
      Serial.printf("[WS] Client #%u disconnected\n", clientNum);
      clientActive = false;
      break;

    case WStype_TEXT:
      handleCommand((char*)payload, clientNum);
      break;

    default:
      break;
  }
}

// ─── Command handler (browser → ring) ────────────────────────────
void handleCommand(const char* cmd, uint8_t clientNum) {
  if (strcmp(cmd, "calibrate") == 0) {
    Serial.println("[CMD] Calibrating — keep ring still for 3s");
    webSocket.sendTXT(clientNum, "{\"event\":\"calibrating\"}");
    mpu.calcOffsets(true, true);
    webSocket.sendTXT(clientNum, "{\"event\":\"calibrated\"}");
    Serial.println("[CMD] Calibration done");

  } else if (strcmp(cmd, "mode:drum") == 0) {
    ringMode = 0;
    webSocket.broadcastTXT("{\"event\":\"mode\",\"value\":\"drum\"}");

  } else if (strcmp(cmd, "mode:guitar") == 0) {
    ringMode = 1;
    webSocket.broadcastTXT("{\"event\":\"mode\",\"value\":\"guitar\"}");

  } else if (strcmp(cmd, "ping") == 0) {
    webSocket.sendTXT(clientNum, "{\"event\":\"pong\"}");
  }
}

// ─── Setup ────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println();
  Serial.println("╔══════════════════════════════╗");
  Serial.println("║   Air Orchestra Firmware     ║");
  Serial.println("╚══════════════════════════════╝");
  Serial.printf("Ring: %s\n\n", RING_ID);

  esp_bt_controller_disable(); // Bluetooth disable
  setCpuFrequencyMhz(80);      // CPU freq min for WiFi

  // Mode button
  pinMode(MODE_BTN_PIN, INPUT_PULLUP);

  // ── MPU6050 init ─────────────────────────────────────────────
  Wire.begin(21, 22);  // SDA=GPIO21, SCL=GPIO22

  Serial.print("Initialising MPU6050...");
  byte status = mpu.begin();
  uint8_t attempts = 0;
  while (status != 0 && attempts < 10) {
    Serial.print(".");
    delay(1000);
    status = mpu.begin();
    attempts++;
  }
  if (status != 0) {
    Serial.println("\n[ERROR] MPU6050 not found!");
    Serial.println("Check: SDA→GPIO21, SCL→GPIO22, VCC→3.3V, GND→GND");
    Serial.println("Halting.");
    while (true) { delay(1000); }
  }
  Serial.println(" OK");

  Serial.println("Calibrating — KEEP RING PERFECTLY STILL for 3 seconds...");
  delay(2500);
  mpu.calcOffsets(true, true);
  Serial.println("Calibration done.\n");

  // ── WiFi Station (Client) Setup ──────────────────────────────
  Serial.printf("Connecting to Ring 1 Hotspot: \"%s\"...\n", AP_SSID);
  
  WiFi.mode(WIFI_STA); // Changed from WIFI_AP to WIFI_STA
  WiFi.begin(AP_SSID, AP_PASS);

  WiFi.setTxPower(WIFI_POWER_2dBm); // Keep power low to save battery

  // Wait for connection to Ring 1
  uint8_t wifiAttempts = 0;
  while (WiFi.status() != WL_CONNECTED && wifiAttempts < 60) {
    delay(500);
    Serial.print(".");
    wifiAttempts++;
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\n[ERROR] WiFi failed. Make sure Ring 1 is powered ON first!");
    Serial.println("Rebooting in 5s...");
    delay(5000);
    ESP.restart();
  }

  // Ring 2 gets its IP address from Ring 1
  IPAddress myIP = WiFi.localIP();
  
  Serial.println("\nConnected to Ring 1!");
  Serial.printf("Ring 2 IP Address: %s\n", myIP.toString().c_str());

  // ── mDNS ─────────────────────────────────────────────────────
  if (MDNS.begin(RING_ID)) {
    MDNS.addService("ws", "tcp", WS_PORT);
    Serial.printf("mDNS: ws://%s.local:%d\n", RING_ID, WS_PORT);
  }

  // ── WebSocket server ─────────────────────────────────────────
  webSocket.begin();
  webSocket.onEvent(onWebSocketEvent);
  webSocket.enableHeartbeat(5000, 2000, 3);

  Serial.printf("WebSocket: ws://%s:%d\n\n",
                myIP.toString().c_str(), WS_PORT);
  Serial.println("Waiting for Mac to connect...");
}

// ─── Main loop ────────────────────────────────────────────────────
void loop() {
  webSocket.loop();
  mpu.update();

  // ── Mode button: toggle drum / guitar ──────────────────────
  uint32_t nowMs = millis();
  if (nowMs - lastBtnCheck >= 50) {  // debounce 50ms
    lastBtnCheck = nowMs;
    bool btnState = digitalRead(MODE_BTN_PIN);
    if (btnState == LOW && btnPrevState == HIGH) {
      ringMode = (ringMode + 1) % 2;
      const char* modeStr = ringMode == 0 ? "drum" : "guitar";
      Serial.printf("[BTN] Mode → %s\n", modeStr);
      char msg[48];
      snprintf(msg, sizeof(msg), "{\"event\":\"mode\",\"value\":\"%s\"}", modeStr);
      webSocket.broadcastTXT(msg);
    }
    btnPrevState = btnState;
  }

  // ── IMU data broadcast ──────────────────────────────────────
  uint32_t nowUs = micros();
  if (nowUs - lastSendUs >= SEND_INTERVAL_US) {
    lastSendUs = nowUs;

    // Read raw button state (LOW means it is currently being pressed down)
    int btnState = digitalRead(MODE_BTN_PIN);

    // Add angX, angY, angZ (Pitch, Roll, Yaw) and b (button)
    char buf[160];
    snprintf(buf, sizeof(buf),
        "{\"t\":%lu,\"ax\":%.2f,\"ay\":%.2f,\"az\":%.2f"
        ",\"gx\":%.1f,\"gy\":%.1f,\"gz\":%.1f"
        ",\"angX\":%.1f,\"angY\":%.1f,\"angZ\":%.1f"
        ",\"m\":%d,\"b\":%d}",
        millis(),
        mpu.getAccX(), mpu.getAccY(), mpu.getAccZ(),
        mpu.getGyroX(), mpu.getGyroY(), mpu.getGyroZ(),
        mpu.getAngleX(), mpu.getAngleY(), mpu.getAngleZ(), // New angles!
        ringMode, btnState
    );

    webSocket.broadcastTXT(buf);
    delay(2); // added delay for the battery to recover
  }
}