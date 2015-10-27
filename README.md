# gd-pi
A NodeJS controller for garage doors over the NRF240L1+ module. 

Currently in the very early stages on development. 
I'm using a Raspberry Pi 2 as the application/api server which interfaces with an Arduino as the garage controller.  

### Goals
- Modularize and extract nrf communications into a streamable abstraction to enable a simple messaging system built on top of a tcp like protocol. 
This would provide reliability and packetization for long(er) messages, bypassing the NRF24L01+ max message length of 32 bytes. 
- Implement easy to use security layer (HMAC/encryption) on top of the NRF module.
- Include implementation to interface with Arduino.
- Implement garage door monitoring/control system.
