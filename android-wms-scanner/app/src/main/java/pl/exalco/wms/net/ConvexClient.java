package pl.exalco.wms.net;

import android.content.Context;
import java.io.IOException;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.json.JSONArray;
import org.json.JSONObject;

public class ConvexClient {
    private static final MediaType JSON_TYPE = MediaType.parse("application/json; charset=utf-8");
    private static final Pattern SKU_URL_PATTERN = Pattern.compile("[?&]sku=([^&#]+)", Pattern.CASE_INSENSITIVE);

    private final OkHttpClient http;
    private String baseUrl;

    public ConvexClient(Context context, String baseUrl) {
        this.baseUrl = normalizeBaseUrl(baseUrl);
        OkHttpClient.Builder builder = new OkHttpClient.Builder()
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(20, TimeUnit.SECONDS)
                .writeTimeout(20, TimeUnit.SECONDS);
        Tls12Helper.enableTls12(context, builder);
        this.http = builder.build();
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = normalizeBaseUrl(baseUrl);
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    private static String normalizeBaseUrl(String raw) {
        if (raw == null) return "";
        String s = raw.trim();
        while (s.endsWith("/")) {
            s = s.substring(0, s.length() - 1);
        }
        return s;
    }

    public static String parseScannedSku(String raw) {
        if (raw == null) return "";
        String trimmed = raw.trim();
        Matcher m = SKU_URL_PATTERN.matcher(trimmed);
        if (m.find()) {
            try {
                return java.net.URLDecoder.decode(m.group(1), "UTF-8").trim().toUpperCase();
            } catch (Exception ignored) {
                return m.group(1).trim().toUpperCase();
            }
        }
        return trimmed.toUpperCase();
    }

    public static class PinSession {
        public final String userId;
        public final String email;
        public final String name;

        public PinSession(String userId, String email, String name) {
            this.userId = userId;
            this.email = email;
            this.name = name;
        }
    }

    public static class IndexInfo {
        public final String materialId;
        public final String sku;
        public final String name;
        public final String unit;
        public final String objectName;
        public final int totalAvailable;
        public final int deliveriesCount;

        public IndexInfo(String materialId, String sku, String name, String unit,
                         String objectName, int totalAvailable, int deliveriesCount) {
            this.materialId = materialId;
            this.sku = sku;
            this.name = name;
            this.unit = unit;
            this.objectName = objectName;
            this.totalAvailable = totalAvailable;
            this.deliveriesCount = deliveriesCount;
        }
    }

    public static class OrderItem {
        public final String id;
        public final String orderNumber;
        public final String clientName;
        public final String status;

        public OrderItem(String id, String orderNumber, String clientName, String status) {
            this.id = id;
            this.orderNumber = orderNumber;
            this.clientName = clientName;
            this.status = status;
        }
    }

    public static class RwResult {
        public final String documentId;
        public final String number;

        public RwResult(String documentId, String number) {
            this.documentId = documentId;
            this.number = number;
        }
    }

    public PinSession verifyPin(String pin) throws Exception {
        ensureBaseUrl();
        JSONObject payload = new JSONObject();
        payload.put("pin", pin);
        JSONObject json = postJson("/api/wms-mobile/pin", payload);
        return new PinSession(
                json.getString("userId"),
                json.optString("email", ""),
                json.optString("name", "")
        );
    }

    public IndexInfo getIndexBySku(String sku, String userId) throws Exception {
        ensureBaseUrl();
        String path = "/api/wms-mobile/index?sku=" + URLEncoder.encode(sku, "UTF-8")
                + (userId != null && !userId.isEmpty() ? "&userId=" + URLEncoder.encode(userId, "UTF-8") : "");
        JSONObject json = getJson(path);
        return new IndexInfo(
                json.getString("materialId"),
                json.optString("sku", sku),
                json.optString("name", ""),
                json.optString("unit", "szt."),
                json.isNull("objectName") ? "" : json.optString("objectName", ""),
                json.optInt("totalAvailable", 0),
                json.optInt("deliveriesCount", 0)
        );
    }

    public List<OrderItem> searchOrders(String search, String userId) throws Exception {
        ensureBaseUrl();
        String path = "/api/wms-mobile/orders?search=" + URLEncoder.encode(search == null ? "" : search, "UTF-8")
                + (userId != null && !userId.isEmpty() ? "&userId=" + URLEncoder.encode(userId, "UTF-8") : "");
        JSONObject json = getJson(path);
        JSONArray arr = json.optJSONArray("orders");
        List<OrderItem> list = new ArrayList<>();
        if (arr != null) {
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                list.add(new OrderItem(
                        o.getString("_id"),
                        o.optString("orderNumber", ""),
                        o.optString("clientName", ""),
                        o.optString("status", "")
                ));
            }
        }
        return list;
    }

    public RwResult createQuickRw(String materialId, String orderId, int quantity, String userId) throws Exception {
        ensureBaseUrl();
        JSONObject payload = new JSONObject();
        payload.put("materialId", materialId);
        payload.put("orderId", orderId);
        payload.put("quantity", quantity);
        if (userId != null && !userId.isEmpty()) {
            payload.put("userId", userId);
        }
        JSONObject json = postJson("/api/wms-mobile/rw", payload);
        return new RwResult(
                json.optString("documentId", ""),
                json.optString("number", "RW")
        );
    }

    private void ensureBaseUrl() throws IOException {
        if (baseUrl == null || baseUrl.isEmpty()) {
            throw new IOException("Brak adresu serwera Convex (.convex.site). Ustaw go w Ustawieniach.");
        }
    }

    private JSONObject getJson(String path) throws Exception {
        Request req = new Request.Builder()
                .url(baseUrl + path)
                .get()
                .build();
        return executeJson(req);
    }

    private JSONObject postJson(String path, JSONObject body) throws Exception {
        Request req = new Request.Builder()
                .url(baseUrl + path)
                .post(RequestBody.create(JSON_TYPE, body.toString()))
                .build();
        return executeJson(req);
    }

    private JSONObject executeJson(Request req) throws Exception {
        try (Response resp = http.newCall(req).execute()) {
            String raw = resp.body() != null ? resp.body().string() : "{}";
            JSONObject json = new JSONObject(raw.isEmpty() ? "{}" : raw);
            if (!resp.isSuccessful()) {
                String msg = json.optString("error", "Błąd HTTP " + resp.code());
                throw new IOException(msg);
            }
            return json;
        }
    }
}
