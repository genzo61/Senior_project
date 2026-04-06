package com.garson.backend.analytics;

import com.garson.backend.dto.report.DailySummaryResponseDto;
import com.garson.backend.dto.report.SalesAnalysisResponseDto;
import com.garson.backend.service.ReportsService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;

@Service
@RequiredArgsConstructor
public class SalesAnalyticsService {

    private final ReportsService reportsService;

    public DailySummaryResponseDto getDailySummary(LocalDate date) {
        return reportsService.getDailySummary(date);
    }

    public SalesAnalysisResponseDto getSalesAnalysis(LocalDate date) {
        return reportsService.getSalesAnalysis(date);
    }
}
