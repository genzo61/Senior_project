package com.garson.backend.exception;

import com.garson.backend.alerts.CriticalErrorAlertService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.OffsetDateTime;
import java.util.Map;

@RestControllerAdvice
@RequiredArgsConstructor
public class GlobalExceptionHandler {

    private final CriticalErrorAlertService criticalErrorAlertService;

    @ExceptionHandler({
            IllegalArgumentException.class,
            MethodArgumentTypeMismatchException.class,
            MethodArgumentNotValidException.class,
            MissingServletRequestParameterException.class
    })
    public ResponseEntity<Map<String, Object>> handleBadRequest(Exception ex) {
        return ResponseEntity.badRequest().body(Map.of(
                "error", "Bad request",
                "message", safeMessage(ex),
                "timestamp", OffsetDateTime.now().toString()));
    }

    @ExceptionHandler({
            NoResourceFoundException.class,
            NoHandlerFoundException.class
    })
    public ResponseEntity<Map<String, Object>> handleNotFound(Exception ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                "error", "Not found",
                "message", safeMessage(ex),
                "timestamp", OffsetDateTime.now().toString()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleUnhandled(
            Exception ex,
            HttpServletRequest request) {
        String requestInfo = request == null
                ? ""
                : (request.getMethod() + " " + request.getRequestURI());

        criticalErrorAlertService.notifyCriticalError(
                "Unhandled backend exception",
                requestInfo + " - " + safeMessage(ex));

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                "error", "Internal server error",
                "message", "Unexpected server error",
                "timestamp", OffsetDateTime.now().toString()));
    }

    private String safeMessage(Exception ex) {
        if (ex == null || ex.getMessage() == null || ex.getMessage().isBlank()) {
            return ex == null ? "Unknown error" : ex.getClass().getSimpleName();
        }
        return ex.getMessage();
    }
}
