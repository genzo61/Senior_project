package com.garson.backend.controller;

import com.garson.backend.model.RestaurantTable;
import com.garson.backend.model.TableStatus;
import com.garson.backend.repository.OrderRepository;
import com.garson.backend.repository.RestaurantTableRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tables")
@RequiredArgsConstructor
@CrossOrigin(origins = "*", methods = { RequestMethod.GET, RequestMethod.POST, RequestMethod.OPTIONS })
public class TableController {

    private final RestaurantTableRepository tableRepository;
    private final OrderRepository orderRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @GetMapping
    public ResponseEntity<List<RestaurantTable>> getAllTables() {
        return ResponseEntity.ok(tableRepository.findAll());
    }

    @PostMapping("/{id}/cagir")
    @Transactional
    public ResponseEntity<?> callRobot(@PathVariable("id") Long id) {
        return tableRepository.findById(id).map(table -> {
            if (table.getStatus() == TableStatus.EMPTY || table.getStatus() == TableStatus.OCCUPIED) {
                table.setStatus(TableStatus.CALLING_ROBOT);
                RestaurantTable updatedTable = tableRepository.save(table);
                messagingTemplate.convertAndSend("/topic/tables", tableRepository.findAll());
                return ResponseEntity.ok(updatedTable);
            }
            return ResponseEntity.badRequest().body("Table cannot be called in current status: " + table.getStatus());
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/kapat")
    @Transactional
    public ResponseEntity<?> closeTable(@PathVariable("id") Long id) {
        return tableRepository.findById(id).map(table -> {
            // Update orders for this table to PAID
            orderRepository.findByTableNo(String.valueOf(id)).forEach(order -> {
                if (!"DELIVERED".equals(order.getStatus()) && !"PAID".equals(order.getStatus())) {
                    order.setStatus("PAID"); // Or DELIVERED, then PAID depending on business logic, going straight to
                                             // PAID for now.
                    orderRepository.save(order);
                } else if ("DELIVERED".equals(order.getStatus())) {
                    order.setStatus("PAID");
                    orderRepository.save(order);
                }
            });

            table.setStatus(TableStatus.EMPTY);
            RestaurantTable updatedTable = tableRepository.save(table);

            // Notify frontend
            messagingTemplate.convertAndSend("/topic/tables", tableRepository.findAll());
            messagingTemplate.convertAndSend("/topic/orders", orderRepository.findAll()); // Also notify order changes

            return ResponseEntity.ok(updatedTable);
        }).orElse(ResponseEntity.notFound().build());
    }
}
