
#include <SPI.h>
#include "nRF24L01.h"
#include "RF24.h"
#include "sha256.h"
#include "printf.h"

const uint8_t doorTopInput = 2;
const uint8_t doorBotInput = 3;
const uint8_t doorControlOutput = 4;
const uint8_t DOOROPEN = 1;
const uint8_t DOORCLOSED = 0;
const uint8_t DOORTRANS = 2;

RF24 radio(7, 8);

byte addr[][6] = {"1Node", "2Node"};
const uint8_t secretKey[32] = {};

const int maxPayloadLen = 32;
char payload[maxPayloadLen + 1];
unsigned long lastDoorAction = 0;

struct Nonce {
  unsigned long t;
  long v;
};

const uint8_t maxActiveNonces = 10;
struct Nonce activeNonces[maxActiveNonces];
uint8_t currentNonceIdx = 0;

void setup() {
  randomSeed(analogRead(0)); // unconnected pin
  Serial.begin(9600);
  printf_begin();
  // db 04 6e 00 -> 7210203
  long wat = 0x6eUL << 16;
  wat += 0x04 << 8;
  wat += 0xdb;
  printf("WAT %ld\n", wat);
  printf("=======================================\n");

  pinMode(doorControlOutput, OUTPUT);

  radio.begin();
  radio.setRetries(15, 15);
  radio.setDataRate(RF24_1MBPS);
  radio.setChannel(0x4c);
  radio.setCRCLength(RF24_CRC_16);
  radio.enableDynamicPayloads();

  radio.openWritingPipe(addr[1]);
  radio.openReadingPipe(1, addr[0]);

  radio.startListening();
  radio.printDetails();
}

void loop() {
  if (radio.available()) {
    uint8_t len = radio.getDynamicPayloadSize();
    
    radio.read(payload, len);
    payload[len] = 0;
    
    printf("payload: ");
    for (int i = 0; i < len; i++) {
      printf("%02X, ", (uint8_t)payload[i]);
    }
    printf("\n");

    uint8_t messageType = payload[0];

    if (messageType == 0xff) { // nonce request
      sendNonce();
    } else if (messageType == 0xaa) { // secure command
      uint8_t messageLen = len - 29;
      uint8_t hmacLen = 24;
      uint8_t nonceLen = sizeof(long);
      
      char hmac[hmacLen];
      char message[messageLen + 1];
      char nonceBuf[nonceLen];
      memcpy(hmac, payload + 1, hmacLen);
      memcpy(nonceBuf, payload + 1 + hmacLen, nonceLen);
      memcpy(message, payload + 1 + hmacLen + nonceLen, messageLen);
      message[messageLen] = 0;

      long nonce = 0;
      for (uint8_t i = 0; i < nonceLen; i++) {
        unsigned long tmp = nonceBuf[i];
        tmp &= 0xff;
        nonce += tmp << 8 * i;
      }

      printf("Nonce HEX: %02X %02X %02X %02X\n", nonceBuf[0], nonceBuf[1], nonceBuf[2], nonceBuf[3]); 
      printf("Nonce LONG: %ld\n", nonce);

      printf("HMAC: %i\n", validHmac(hmac, nonce, message, hmacLen));

      if (validHmac(hmac, nonce, message, hmacLen)) {
        switch (message[0]) {
          case 0x01:
            sendDoorState();
            break;
          case 0x02:
            toggleDoor();
            break;
        } 
      }
    }
    
  }

  if (getDoorState() == DOOROPEN) {
    digitalWrite(doorControlOutput, HIGH);
  } else {
    digitalWrite(doorControlOutput, LOW);
  }
}

void toggleDoor() {
  unsigned long now = millis();
  printf("toggling door %ld\n", now - lastDoorAction);
  if (now - lastDoorAction > 1000) {
    lastDoorAction = now;
    digitalWrite(doorControlOutput, HIGH);
    delay(1000);
    digitalWrite(doorControlOutput, LOW);
  }
}

// 0 = closed, 1 = open, 2 = in transition
uint8_t getDoorState() {
  int doorTop = digitalRead(doorTopInput);
  int doorBot = digitalRead(doorBotInput);

  return doorTop == HIGH ? DOOROPEN : doorBot == HIGH ? DOORCLOSED : DOORTRANS;
}

void sendDoorState() {
  radio.stopListening();
  
  uint8_t state = getDoorState();
  printf("doorstate: %i\n", state);
  radio.write(&state, 1);
  
  radio.startListening();
}

bool validHmac(char *hmac, long nonce, char *message, uint8_t len) {
  printf("VALID NONCE: %i\n", isValidNonce(nonce));
  if (!isValidNonce(nonce)) {
    return false;
  }

  uint8_t nonceBufLen = sizeof(long) + 1;
  char nonceBuf[nonceBufLen];
  printf("NONCE BUF: ");
  for (uint8_t i = 0; i < sizeof(long); i++) {
    nonceBuf[i] = (nonce >> 8 * i) & 0xff;
    printf("%02X ", nonceBuf[i]);
  }
  printf("\n");

  nonceBuf[nonceBufLen - 1] = 0;
  
  uint8_t *checkHash;
  Sha256.initHmac(secretKey, 32);
  Sha256.print(nonceBuf);
  Sha256.print(message);
  checkHash = Sha256.resultHmac();
  checkHash[224] = 0;

  for (int i = 0; i < len; i++) {
    if (checkHash[i] != (uint8_t)hmac[i]) {
      return false;
    }
  }
  return true;
}

void sendNonce() {
  radio.stopListening();
  
  long nonce = generateNonce();
  printf("Nonce: %ld\n", nonce);
  char mlen = 2 + sizeof(long);
  char message[mlen];
  message[0] = 0xff;
  message[1] = sizeof(long);
  memcpy(message + 2, &nonce, message[1]);
  radio.write(message, mlen);
  
  radio.startListening();
}

// Nonces invalidate after 2 sec
bool isValidNonce(long nonce) {
  unsigned long now = millis();
  for (uint8_t i = 0; i < maxActiveNonces; i++) {
    if (nonce == activeNonces[i].v && now - activeNonces[i].t < 2000) {
      return true;
    }
  }
  return false;
}

void printActiveNonces() {
  printf("ACTIVE: ");
  for (uint8_t i = 0; i < maxActiveNonces; i++) {
    printf("%ld/%ld ", activeNonces[i].t, activeNonces[i].v);
  }
  printf("\n");
}

long generateNonce() {
  long nonce = random();
  unsigned long now = millis();

  struct Nonce *currentNonce = &activeNonces[currentNonceIdx];
  currentNonce->t = now;
  currentNonce->v = nonce;

  currentNonceIdx++;
  if (currentNonceIdx >= maxActiveNonces) {
    currentNonceIdx = 0;
  }
  return nonce;
}
