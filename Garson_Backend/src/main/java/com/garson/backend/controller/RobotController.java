package com.garson.backend.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
//import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/robot")
@RequiredArgsConstructor
@CrossOrigin(origins = "*") // Herkese acik (Musternin telefonundan gelen web istegi)
public class RobotController {

    //private final SimpMessagingTemplate messagingTemplate;

    @PostMapping("/call")
    public ResponseEntity<String> callRobot(@RequestParam String table) {

        System.out.println("🤖 Robot Masaya Cagirildi: Masa " + table);

        // Eger Mutfak KDS uzerinde "Robot Cagrisi" gormek istersen:
        // messagingTemplate.convertAndSend("/topic/calls", "Masa " + table + " robotu
        // cagirdi!");

        // Normalde bu bilgi gercek robotun socket kanalina duser ve robot fiziki olarak
        // o masaya hareket eder.
        return ResponseEntity.ok("Robot Masa " + table + " icin yola cikti.");
    }
}
