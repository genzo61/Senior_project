package com.garson.backend.controller;

import com.garson.backend.dto.report.CustomerEngagementResponseDto;
import com.garson.backend.dto.report.DailySummaryResponseDto;
import com.garson.backend.dto.report.RestockSuggestionsResponseDto;
import com.garson.backend.dto.report.SalesAnalysisResponseDto;
import com.garson.backend.service.ReportsService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.Map;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
@CrossOrigin(origins = "*", methods = {RequestMethod.GET, RequestMethod.OPTIONS})
public class ReportsController {

    private final ReportsService reportsService;

    @GetMapping("/daily-summary")
    public ResponseEntity<DailySummaryResponseDto> getDailySummary(
            @RequestParam("date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(reportsService.getDailySummary(date));
    }

    @GetMapping("/sales-analysis")
    public ResponseEntity<SalesAnalysisResponseDto> getSalesAnalysis(
            @RequestParam("date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(reportsService.getSalesAnalysis(date));
    }

    @GetMapping("/customer-engagement")
    public ResponseEntity<CustomerEngagementResponseDto> getCustomerEngagement(
            @RequestParam("date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(reportsService.getCustomerEngagement(date));
    }

    @GetMapping("/restock-suggestions")
    public ResponseEntity<?> getRestockSuggestions(@RequestParam(name = "days", defaultValue = "3") Integer days) {
        if (days == null || days < 1) {
            return ResponseEntity.badRequest().body(Map.of("error", "days must be >= 1"));
        }

        RestockSuggestionsResponseDto response = reportsService.getRestockSuggestions(days);
        return ResponseEntity.ok(response);
    }
}
