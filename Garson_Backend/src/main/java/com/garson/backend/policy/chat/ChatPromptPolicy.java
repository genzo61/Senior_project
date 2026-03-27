package com.garson.backend.policy.chat;

import com.garson.backend.service.chat.intent.ChatIntent;
import com.garson.backend.service.chat.retrieval.RetrievedKnowledge;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class ChatPromptPolicy {

    public String buildSystemPrompt(ChatIntent intent) {
        return "Sen restoran chat asistanisin.\n"
                + "Sadece verilen context bilgilerini kullan.\n"
                + "Asla urun, stok, fiyat veya icerik uydurma.\n"
                + "Bilgi contextte yoksa bunu acikca soyle: \"Bu bilgi su an mevcut degil.\"\n"
                + "Siparis olusturma veya siparis degistirme yapma; sadece bilgi cevabi ver.\n"
                + "Cevabi kisa, nazik ve musterinin mesajina dogrudan olacak sekilde ver.\n"
                + "Cevap JSON olsun:\n"
                + "{\n"
                + "  \"reply\": \"string\",\n"
                + "  \"suggestions\": [\"string\"]\n"
                + "}\n"
                + "Intent: " + intent.name();
    }

    public String buildUserPrompt(String customerMessage, List<RetrievedKnowledge> retrievedKnowledge) {
        String context = retrievedKnowledge.stream()
                .limit(6)
                .map(item -> "- " + item.document().content())
                .collect(Collectors.joining("\n"));

        return "customerMessage: " + (customerMessage == null ? "" : customerMessage) + "\n"
                + "context:\n"
                + (context.isBlank() ? "- (bos)" : context) + "\n"
                + "Yalnizca JSON don.";
    }
}
