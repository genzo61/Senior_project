package com.garson.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.garson.backend.dto.ai.CustomerAiChatRequest;
import com.garson.backend.dto.ai.CustomerAiChatResponse;
import com.garson.backend.model.Product;
import com.garson.backend.repository.ProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomerAiServiceTest {

    @Mock
    private ProductRepository productRepository;

    @Mock
    private OllamaClient ollamaClient;

    @Mock
    private ProductRagService productRagService;

    private CustomerAiService customerAiService;

    @BeforeEach
    void setUp() {
        customerAiService = new CustomerAiService(productRepository, ollamaClient, productRagService, new ObjectMapper());
        ReflectionTestUtils.setField(customerAiService, "debugLogging", false);
        lenient().when(productRagService.retrieveRelevantProducts(anyString(), anyList(), anyInt()))
                .thenAnswer(invocation -> invocation.getArgument(1));
        lenient().when(productRagService.toPromptContextJson(anyList())).thenReturn("[]");
    }

    @Test
    void shouldHandleSimpleCartUpdateDeterministicallyWithoutLlm() {
        when(productRepository.findAll()).thenReturn(sampleProducts());

        CustomerAiChatResponse response = customerAiService.handleCustomerChat(request("bir kola ekle"));

        assertEquals("cart_update", response.getIntent());
        assertEquals(1, response.getItems().size());
        assertEquals("Kola", response.getItems().get(0).getProductName());
        assertEquals(1, response.getItems().get(0).getQuantity());
        verify(ollamaClient, never()).chatJsonOnly(anyString(), anyString());
    }

    @Test
    void shouldSeparateNoteFromProductForAciliPatates() {
        when(productRepository.findAll()).thenReturn(sampleProducts());

        CustomerAiChatResponse response = customerAiService.handleCustomerChat(request("acili patates ekle"));

        assertEquals("cart_update", response.getIntent());
        assertEquals(1, response.getItems().size());
        assertEquals("Patates Kizartmasi", response.getItems().get(0).getProductName());
        assertTrue(response.getItems().get(0).getSpecialNote().contains("Acili"));
    }

    @Test
    void shouldReturnMenuAssistantForSuggestionRequest() {
        when(productRepository.findAll()).thenReturn(sampleProducts());

        CustomerAiChatResponse response = customerAiService.handleCustomerChat(request("sutlu tatlilardan ne onerirsin"));

        assertEquals("menu_assistant", response.getIntent());
        assertFalse(response.getSuggestedProducts().isEmpty());
        verify(ollamaClient, never()).chatJsonOnly(anyString(), anyString());
    }

    @Test
    void shouldSupportQuantityAndNoteVariants() {
        when(productRepository.findAll()).thenReturn(sampleProducts());

        CustomerAiChatResponse ayranResponse = customerAiService.handleCustomerChat(request("iki ayran olsun"));
        assertEquals("cart_update", ayranResponse.getIntent());
        assertEquals(2, ayranResponse.getItems().get(0).getQuantity());
        assertEquals("Ayran", ayranResponse.getItems().get(0).getProductName());

        CustomerAiChatResponse kahveResponse = customerAiService.handleCustomerChat(request("bir kahve ekle sekersiz olsun"));
        assertEquals("cart_update", kahveResponse.getIntent());
        assertEquals("Kahve", kahveResponse.getItems().get(0).getProductName());
        assertTrue(kahveResponse.getItems().get(0).getSpecialNote().contains("Sekersiz"));
    }

    @Test
    void shouldHandleMultipleProductsInSingleSentence() {
        when(productRepository.findAll()).thenReturn(sampleProducts());

        CustomerAiChatResponse response = customerAiService.handleCustomerChat(request("1 ayran bir lahmacun istiyorum"));

        assertEquals("cart_update", response.getIntent());
        assertEquals(2, response.getItems().size());

        Map<String, Integer> quantityByName = response.getItems().stream()
                .collect(java.util.stream.Collectors.toMap(
                        item -> item.getProductName(),
                        item -> item.getQuantity()));

        assertEquals(1, quantityByName.get("Ayran"));
        assertEquals(1, quantityByName.get("Lahmacun"));
        verify(ollamaClient, never()).chatJsonOnly(anyString(), anyString());
    }

    @Test
    void shouldHandleSoupAndBurgerNotesSafely() {
        when(productRepository.findAll()).thenReturn(sampleProducts());

        CustomerAiChatResponse soupResponse = customerAiService.handleCustomerChat(request("corba ekle az tuzlu olsun"));
        assertEquals("cart_update", soupResponse.getIntent());
        assertEquals("Mercimek Corbasi", soupResponse.getItems().get(0).getProductName());
        assertTrue(soupResponse.getItems().get(0).getSpecialNote().contains("Az tuzlu"));

        CustomerAiChatResponse burgerResponse = customerAiService.handleCustomerChat(request("bir hamburger olsun ama sogansiz"));
        assertEquals("cart_update", burgerResponse.getIntent());
        assertTrue(burgerResponse.getItems().get(0).getSpecialNote().contains("Sogansiz"));
    }

    @Test
    void shouldReturnClarificationForAmbiguousRequests() {
        when(productRepository.findAll()).thenReturn(sampleProducts());

        CustomerAiChatResponse response = customerAiService.handleCustomerChat(request("karisik bir sey yap"));

        assertEquals("clarification", response.getIntent());
        assertTrue(response.getItems().isEmpty());
    }

    @Test
    void shouldHandleMenuAssistantExamplesWithoutLlm() {
        when(productRepository.findAll()).thenReturn(sampleProducts());

        CustomerAiChatResponse hafif = customerAiService.handleCustomerChat(request("hafif bir sey istiyorum"));
        assertEquals("menu_assistant", hafif.getIntent());
        assertFalse(hafif.getSuggestedProducts().isEmpty());

        CustomerAiChatResponse tavuk = customerAiService.handleCustomerChat(request("tavuklu ne var"));
        assertEquals("menu_assistant", tavuk.getIntent());
        assertFalse(tavuk.getSuggestedProducts().isEmpty());

        CustomerAiChatResponse yanina = customerAiService.handleCustomerChat(request("bunun yanina ne gider"));
        assertEquals("menu_assistant", yanina.getIntent());
        verify(ollamaClient, never()).chatJsonOnly(anyString(), anyString());
    }

    @Test
    void shouldReturnUnsupportedForNonMenuProduct() {
        when(productRepository.findAll()).thenReturn(sampleProducts());

        CustomerAiChatResponse response = customerAiService.handleCustomerChat(request("bir sushi ekle"));

        assertEquals("unsupported", response.getIntent());
        assertTrue(response.getItems().isEmpty());
        verify(ollamaClient, never()).chatJsonOnly(anyString(), anyString());
    }

    @Test
    void shouldFallbackToClarificationOnInvalidOllamaJson() {
        when(productRepository.findAll()).thenReturn(sampleProducts());
        when(ollamaClient.chatJsonOnly(anyString(), anyString())).thenReturn(Optional.of("not-json"));

        CustomerAiChatResponse response = customerAiService.handleCustomerChat(request("yardimci olur musun"));

        assertEquals("clarification", response.getIntent());
    }

    private CustomerAiChatRequest request(String message) {
        CustomerAiChatRequest request = new CustomerAiChatRequest();
        request.setTableId(1L);
        request.setMessage(message);
        request.setCart(List.of());
        return request;
    }

    private List<Product> sampleProducts() {
        return List.of(
                product(1L, "Kola", "Icecek", "acisiz,popular"),
                product(2L, "Ayran", "Icecek", "acisiz,popular"),
                product(3L, "Patates Kizartmasi", "Atistirmalik", "popular"),
                product(4L, "Hamburger", "Burger", "popular"),
                product(5L, "Sutlac", "Tatli", "sutlu tatli"),
                product(6L, "Tiramisu", "Tatli", "sutlu tatli"),
                product(7L, "Kahve", "Icecek", "acisiz"),
                product(8L, "Mercimek Corbasi", "Corba", "acisiz"),
                product(9L, "Tavuk Burger", "Burger", "tavuk"),
                product(10L, "Lahmacun", "Kebap", "popular"));
    }

    private Product product(Long id, String name, String category, String tags) {
        Product product = new Product();
        product.setId(id);
        product.setName(name);
        product.setCategory(category);
        product.setTags(tags);
        product.setStock(50);
        product.setPrice(10.0);
        return product;
    }
}
