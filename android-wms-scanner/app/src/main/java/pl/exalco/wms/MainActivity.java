package pl.exalco.wms;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import pl.exalco.wms.net.ConvexClient;

public class MainActivity extends Activity {
    private static final String PREFS_NAME = "exalco_wms_prefs";
    private static final String KEY_CONVEX_URL = "convex_site_url";
    private static final String ACTION_DATAWEDGE_SCAN = "pl.exalco.wms.SCAN";

    private enum Step {
        PIN, SCAN, PREVIEW, ORDER, QUANTITY, SUCCESS
    }

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private ConvexClient client;
    private SharedPreferences prefs;

    private Step step = Step.PIN;
    private boolean loading = false;
    private String errorMessage = null;

    private String pinInput = "";
    private ConvexClient.PinSession session = null;
    private ConvexClient.IndexInfo currentIndex = null;
    private List<ConvexClient.OrderItem> orders = new ArrayList<>();
    private ConvexClient.OrderItem selectedOrder = null;
    private String orderSearch = "";
    private int quantity = 1;
    private ConvexClient.RwResult lastRw = null;

    // Keystroke HID fallback buffer
    private final StringBuilder keyBuffer = new StringBuilder();
    private long lastKeyAt = 0L;

    private LinearLayout rootContainer;

    private final BroadcastReceiver dataWedgeReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent == null) return;
            String data = intent.getStringExtra("com.symbol.datawedge.data_string");
            if (data == null) {
                data = intent.getStringExtra("com.motorolasolutions.emdk.datawedge.data_string");
            }
            if (data != null && !data.trim().isEmpty()) {
                handleScannedRaw(data);
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String savedUrl = prefs.getString(KEY_CONVEX_URL, BuildConfig.DEFAULT_CONVEX_SITE_URL);
        client = new ConvexClient(this, savedUrl);

        rootContainer = new LinearLayout(this);
        rootContainer.setOrientation(LinearLayout.VERTICAL);
        rootContainer.setBackgroundColor(Color.parseColor("#0B0F19"));
        setContentView(rootContainer);

        render();
    }

    @Override
    protected void onResume() {
        super.onResume();
        IntentFilter filter = new IntentFilter();
        filter.addAction(ACTION_DATAWEDGE_SCAN);
        filter.addCategory(Intent.CATEGORY_DEFAULT);
        registerReceiver(dataWedgeReceiver, filter);
    }

    @Override
    protected void onPause() {
        super.onPause();
        try {
            unregisterReceiver(dataWedgeReceiver);
        } catch (IllegalArgumentException ignored) {}
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        executor.shutdownNow();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if ((step == Step.SCAN || step == Step.SUCCESS) && session != null && !loading) {
            View focused = getCurrentFocus();
            boolean inEditText = focused instanceof EditText;
            if (!inEditText && event.getAction() == KeyEvent.ACTION_DOWN) {
                int keyCode = event.getKeyCode();
                if (keyCode == KeyEvent.KEYCODE_ENTER || keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER) {
                    if (keyBuffer.length() >= 2) {
                        String raw = keyBuffer.toString();
                        keyBuffer.setLength(0);
                        handleScannedRaw(raw);
                        return true;
                    }
                    keyBuffer.setLength(0);
                } else {
                    int unicode = event.getUnicodeChar();
                    if (unicode >= 32 && unicode <= 126) {
                        long now = System.currentTimeMillis();
                        if (now - lastKeyAt > 250) {
                            keyBuffer.setLength(0);
                        }
                        lastKeyAt = now;
                        keyBuffer.append((char) unicode);
                    }
                }
            }
        }
        return super.dispatchKeyEvent(event);
    }

    private void handleScannedRaw(String raw) {
        if (session == null || loading) return;
        if (step != Step.SCAN && step != Step.SUCCESS && step != Step.PREVIEW) return;

        final String sku = ConvexClient.parseScannedSku(raw);
        if (sku.isEmpty()) return;

        loading = true;
        errorMessage = null;
        selectedOrder = null;
        quantity = 1;
        lastRw = null;
        render();

        executor.execute(() -> {
            try {
                ConvexClient.IndexInfo info = client.getIndexBySku(sku, session.userId);
                mainHandler.post(() -> {
                    loading = false;
                    currentIndex = info;
                    quantity = info.totalAvailable > 0 ? 1 : 0;
                    step = Step.PREVIEW;
                    render();
                });
            } catch (final Exception e) {
                mainHandler.post(() -> {
                    loading = false;
                    errorMessage = e.getMessage();
                    step = Step.SCAN;
                    render();
                });
            }
        });
    }

    private void submitPin(final String pin) {
        if (loading) return;
        loading = true;
        errorMessage = null;
        render();

        executor.execute(() -> {
            try {
                ConvexClient.PinSession s = client.verifyPin(pin);
                mainHandler.post(() -> {
                    loading = false;
                    session = s;
                    pinInput = "";
                    step = Step.SCAN;
                    render();
                });
            } catch (final Exception e) {
                mainHandler.post(() -> {
                    loading = false;
                    pinInput = "";
                    errorMessage = e.getMessage();
                    render();
                });
            }
        });
    }

    private void loadOrders(final String search) {
        if (session == null) return;
        loading = true;
        errorMessage = null;
        render();

        executor.execute(() -> {
            try {
                List<ConvexClient.OrderItem> list = client.searchOrders(search, session.userId);
                mainHandler.post(() -> {
                    loading = false;
                    orders = list;
                    render();
                });
            } catch (final Exception e) {
                mainHandler.post(() -> {
                    loading = false;
                    errorMessage = e.getMessage();
                    render();
                });
            }
        });
    }

    private void submitRw() {
        if (session == null || currentIndex == null || selectedOrder == null || loading) return;
        if (quantity <= 0 || quantity > currentIndex.totalAvailable) {
            errorMessage = "Ilość musi być od 1 do " + currentIndex.totalAvailable;
            render();
            return;
        }

        loading = true;
        errorMessage = null;
        render();

        executor.execute(() -> {
            try {
                ConvexClient.RwResult res = client.createQuickRw(
                        currentIndex.materialId,
                        selectedOrder.id,
                        quantity,
                        session.userId
                );
                mainHandler.post(() -> {
                    loading = false;
                    lastRw = res;
                    step = Step.SUCCESS;
                    render();
                });
            } catch (final Exception e) {
                mainHandler.post(() -> {
                    loading = false;
                    errorMessage = e.getMessage();
                    render();
                });
            }
        });
    }

    private void showServerSettingsDialog() {
        final EditText input = new EditText(this);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setHint("https://twoja-instancja.convex.site");
        input.setText(client.getBaseUrl());
        input.setTextColor(Color.WHITE);

        new AlertDialog.Builder(this)
                .setTitle("Adres serwera Convex")
                .setMessage("Podaj bazowy adres .convex.site:")
                .setView(input)
                .setPositiveButton("Zapisz", (d, w) -> {
                    String url = input.getText().toString().trim();
                    prefs.edit().putString(KEY_CONVEX_URL, url).apply();
                    client.setBaseUrl(url);
                    Toast.makeText(this, "Zapisano adres serwera", Toast.LENGTH_SHORT).show();
                })
                .setNegativeButton("Anuluj", null)
                .show();
    }

    // ─── UI Rendering ────────────────────────────────────────────────────────

    private void render() {
        rootContainer.removeAllViews();

        if (step == Step.PIN) {
            renderPinScreen();
            return;
        }

        rootContainer.addView(buildTopBar());

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        LinearLayout body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        int pad = dp(16);
        body.setPadding(pad, pad, pad, pad);
        scroll.addView(body);
        rootContainer.addView(scroll, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        if (loading) {
            ProgressBar pb = new ProgressBar(this);
            body.addView(pb);
        }

        if (errorMessage != null && !errorMessage.isEmpty()) {
            body.addView(buildErrorBanner(errorMessage));
        }

        switch (step) {
            case SCAN:
                renderScanScreen(body);
                break;
            case PREVIEW:
                renderPreviewScreen(body);
                break;
            case ORDER:
                renderOrderScreen(body);
                break;
            case QUANTITY:
                renderQuantityScreen(body);
                break;
            case SUCCESS:
                renderSuccessScreen(body);
                break;
            default:
                break;
        }
    }

    private View buildTopBar() {
        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setBackgroundColor(Color.parseColor("#111726"));
        bar.setPadding(dp(12), dp(10), dp(12), dp(10));

        Button backBtn = makeButton("←", "#1E293B", "#F8FAFC", 16);
        backBtn.setOnClickListener(v -> {
            errorMessage = null;
            if (step == Step.PREVIEW) {
                step = Step.SCAN;
            } else if (step == Step.ORDER) {
                step = Step.PREVIEW;
            } else if (step == Step.QUANTITY) {
                step = Step.ORDER;
            } else if (step == Step.SUCCESS) {
                step = Step.SCAN;
            } else {
                session = null;
                pinInput = "";
                step = Step.PIN;
            }
            render();
        });
        bar.addView(backBtn, new LinearLayout.LayoutParams(dp(44), dp(40)));

        TextView title = new TextView(this);
        title.setText(getStepTitle());
        title.setTextColor(Color.parseColor("#F8FAFC"));
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        title.setTypeface(null, Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        bar.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

        Button logoutBtn = makeButton("PIN", "#1E293B", "#94A3B8", 12);
        logoutBtn.setOnClickListener(v -> {
            session = null;
            pinInput = "";
            errorMessage = null;
            step = Step.PIN;
            render();
        });
        bar.addView(logoutBtn, new LinearLayout.LayoutParams(dp(54), dp(40)));

        return bar;
    }

    private String getStepTitle() {
        switch (step) {
            case SCAN: return "Skaner WMS (TC55)";
            case PREVIEW: return "Indeks towarowy";
            case ORDER: return "Wybierz zlecenie";
            case QUANTITY: return "Ilość do wydania";
            case SUCCESS: return "Wydano (RW)";
            default: return "Exalco WMS";
        }
    }

    private void renderPinScreen() {
        LinearLayout wrap = new LinearLayout(this);
        wrap.setOrientation(LinearLayout.VERTICAL);
        wrap.setGravity(Gravity.CENTER_HORIZONTAL);
        wrap.setPadding(dp(20), dp(24), dp(20), dp(20));

        TextView title = new TextView(this);
        title.setText("Exalco WMS Skaner");
        title.setTextColor(Color.parseColor("#F8FAFC"));
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        title.setTypeface(null, Typeface.BOLD);
        wrap.addView(title);

        TextView sub = new TextView(this);
        sub.setText("Podaj 4-cyfrowy PIN");
        sub.setTextColor(Color.parseColor("#94A3B8"));
        sub.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        sub.setPadding(0, dp(4), 0, dp(16));
        wrap.addView(sub);

        TextView dots = new TextView(this);
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 4; i++) {
            sb.append(i < pinInput.length() ? "●  " : "○  ");
        }
        dots.setText(sb.toString().trim());
        dots.setTextColor(Color.parseColor("#38BDF8"));
        dots.setTextSize(TypedValue.COMPLEX_UNIT_SP, 24);
        dots.setPadding(0, 0, 0, dp(16));
        wrap.addView(dots);

        if (loading) {
            wrap.addView(new ProgressBar(this));
        }
        if (errorMessage != null) {
            wrap.addView(buildErrorBanner(errorMessage));
        }

        String[][] rows = {
                {"1", "2", "3"},
                {"4", "5", "6"},
                {"7", "8", "9"},
                {"Usuń", "0", "Serwer"}
        };

        for (String[] row : rows) {
            LinearLayout rowLayout = new LinearLayout(this);
            rowLayout.setOrientation(LinearLayout.HORIZONTAL);
            rowLayout.setGravity(Gravity.CENTER);
            for (final String key : row) {
                Button b = makeButton(key, "#141B2D",
                        key.length() > 1 ? "#94A3B8" : "#F8FAFC",
                        key.length() > 1 ? 12 : 20);
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(74), dp(58));
                lp.setMargins(dp(6), dp(6), dp(6), dp(6));
                b.setOnClickListener(v -> onPinKey(key));
                rowLayout.addView(b, lp);
            }
            wrap.addView(rowLayout);
        }

        rootContainer.addView(wrap);
    }

    private void onPinKey(String key) {
        if (loading) return;
        errorMessage = null;
        if ("Usuń".equals(key)) {
            if (!pinInput.isEmpty()) {
                pinInput = pinInput.substring(0, pinInput.length() - 1);
            }
            render();
        } else if ("Serwer".equals(key)) {
            showServerSettingsDialog();
        } else if (pinInput.length() < 4) {
            pinInput += key;
            render();
            if (pinInput.length() == 4) {
                submitPin(pinInput);
            }
        }
    }

    private void renderScanScreen(LinearLayout body) {
        LinearLayout card = makeCard("#111726", "#38BDF8");
        TextView t = new TextView(this);
        t.setText("Gotowy do skanowania");
        t.setTextColor(Color.parseColor("#F8FAFC"));
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        t.setTypeface(null, Typeface.BOLD);
        t.setGravity(Gravity.CENTER);
        card.addView(t);

        TextView sub = new TextView(this);
        sub.setText("Naciśnij fizyczny spust lasera 1D w Symbol TC55, aby zeskanować kod kreskowy SKU.");
        sub.setTextColor(Color.parseColor("#94A3B8"));
        sub.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        sub.setGravity(Gravity.CENTER);
        sub.setPadding(0, dp(8), 0, 0);
        card.addView(sub);

        body.addView(card);

        TextView orLabel = new TextView(this);
        orLabel.setText("Lub wpisz kod SKU ręcznie:");
        orLabel.setTextColor(Color.parseColor("#94A3B8"));
        orLabel.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        orLabel.setPadding(0, dp(18), 0, dp(6));
        body.addView(orLabel);

        final EditText skuInput = makeInput("np. PE50");
        body.addView(skuInput);

        Button goBtn = makeButton("Szukaj indeksu", "#2563EB", "#FFFFFF", 15);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(48));
        lp.topMargin = dp(10);
        goBtn.setOnClickListener(v -> handleScannedRaw(skuInput.getText().toString()));
        body.addView(goBtn, lp);
    }

    private void renderPreviewScreen(LinearLayout body) {
        if (currentIndex == null) return;

        LinearLayout card = makeCard("#111726", "#334155");
        TextView sku = new TextView(this);
        sku.setText(currentIndex.sku);
        sku.setTextColor(Color.parseColor("#38BDF8"));
        sku.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        sku.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        card.addView(sku);

        TextView name = new TextView(this);
        name.setText(currentIndex.name);
        name.setTextColor(Color.parseColor("#F8FAFC"));
        name.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        name.setTypeface(null, Typeface.BOLD);
        name.setPadding(0, dp(4), 0, dp(10));
        card.addView(name);

        TextView stock = new TextView(this);
        stock.setText("Dostępne: " + currentIndex.totalAvailable + " " + currentIndex.unit
                + " (" + currentIndex.deliveriesCount + " dostaw)");
        stock.setTextColor(currentIndex.totalAvailable > 0
                ? Color.parseColor("#22C55E")
                : Color.parseColor("#F87171"));
        stock.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        stock.setTypeface(null, Typeface.BOLD);
        card.addView(stock);

        if (currentIndex.objectName != null && !currentIndex.objectName.isEmpty()) {
            TextView obj = new TextView(this);
            obj.setText("Magazyn: " + currentIndex.objectName);
            obj.setTextColor(Color.parseColor("#94A3B8"));
            obj.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
            obj.setPadding(0, dp(6), 0, 0);
            card.addView(obj);
        }

        body.addView(card);

        if (currentIndex.totalAvailable > 0) {
            Button nextBtn = makeButton("Wydaj na zlecenie (RW) →", "#2563EB", "#FFFFFF", 15);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, dp(50));
            lp.topMargin = dp(14);
            nextBtn.setOnClickListener(v -> {
                step = Step.ORDER;
                loadOrders(orderSearch);
            });
            body.addView(nextBtn, lp);
        }

        Button rescanBtn = makeButton("Skanuj inny indeks", "#1E293B", "#F8FAFC", 14);
        LinearLayout.LayoutParams lp2 = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(46));
        lp2.topMargin = dp(10);
        rescanBtn.setOnClickListener(v -> {
            step = Step.SCAN;
            render();
        });
        body.addView(rescanBtn, lp2);
    }

    private void renderOrderScreen(LinearLayout body) {
        final EditText searchInput = makeInput("Szukaj zlecenia lub klienta…");
        searchInput.setText(orderSearch);
        body.addView(searchInput);

        Button searchBtn = makeButton("Szukaj", "#1E293B", "#38BDF8", 14);
        LinearLayout.LayoutParams sLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(42));
        sLp.topMargin = dp(8);
        sLp.bottomMargin = dp(12);
        searchBtn.setOnClickListener(v -> {
            orderSearch = searchInput.getText().toString().trim();
            loadOrders(orderSearch);
        });
        body.addView(searchBtn, sLp);

        if (orders.isEmpty() && !loading) {
            TextView empty = new TextView(this);
            empty.setText("Brak zleceń spełniających kryteria.");
            empty.setTextColor(Color.parseColor("#94A3B8"));
            body.addView(empty);
            return;
        }

        for (final ConvexClient.OrderItem order : orders) {
            LinearLayout row = makeCard("#111726", "#334155");
            LinearLayout.LayoutParams rLp = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            rLp.bottomMargin = dp(8);
            row.setOnClickListener(v -> {
                selectedOrder = order;
                step = Step.QUANTITY;
                errorMessage = null;
                render();
            });

            TextView num = new TextView(this);
            num.setText(order.orderNumber);
            num.setTextColor(Color.parseColor("#F8FAFC"));
            num.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
            num.setTypeface(null, Typeface.BOLD);
            row.addView(num);

            if (order.clientName != null && !order.clientName.isEmpty()) {
                TextView cl = new TextView(this);
                cl.setText(order.clientName);
                cl.setTextColor(Color.parseColor("#94A3B8"));
                cl.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
                row.addView(cl);
            }
            body.addView(row, rLp);
        }
    }

    private void renderQuantityScreen(LinearLayout body) {
        if (currentIndex == null || selectedOrder == null) return;

        LinearLayout summary = makeCard("#111726", "#334155");
        TextView info = new TextView(this);
        info.setText(currentIndex.sku + " • " + currentIndex.name + "\nZlecenie: " + selectedOrder.orderNumber);
        info.setTextColor(Color.parseColor("#E2E8F0"));
        info.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        summary.addView(info);
        body.addView(summary);

        LinearLayout stepper = new LinearLayout(this);
        stepper.setOrientation(LinearLayout.HORIZONTAL);
        stepper.setGravity(Gravity.CENTER);
        stepper.setPadding(0, dp(18), 0, dp(12));

        Button minus = makeButton("−", "#1E293B", "#FFFFFF", 22);
        minus.setOnClickListener(v -> {
            if (quantity > 1) {
                quantity--;
                render();
            }
        });
        stepper.addView(minus, new LinearLayout.LayoutParams(dp(64), dp(54)));

        TextView qtyTv = new TextView(this);
        qtyTv.setText(quantity + " " + currentIndex.unit);
        qtyTv.setTextColor(Color.parseColor("#38BDF8"));
        qtyTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        qtyTv.setTypeface(null, Typeface.BOLD);
        qtyTv.setGravity(Gravity.CENTER);
        stepper.addView(qtyTv, new LinearLayout.LayoutParams(dp(130), ViewGroup.LayoutParams.WRAP_CONTENT));

        Button plus = makeButton("+", "#1E293B", "#FFFFFF", 22);
        plus.setOnClickListener(v -> {
            if (quantity < currentIndex.totalAvailable) {
                quantity++;
                render();
            }
        });
        stepper.addView(plus, new LinearLayout.LayoutParams(dp(64), dp(54)));
        body.addView(stepper);

        LinearLayout quickRow = new LinearLayout(this);
        quickRow.setOrientation(LinearLayout.HORIZONTAL);
        quickRow.setGravity(Gravity.CENTER);
        int[] presets = {1, 5, 10, currentIndex.totalAvailable};
        String[] labels = {"1", "5", "10", "Max (" + currentIndex.totalAvailable + ")"};
        for (int i = 0; i < presets.length; i++) {
            final int val = presets[i];
            if (val <= currentIndex.totalAvailable && val > 0) {
                Button p = makeButton(labels[i], "#141B2D", "#CBD5E1", 12);
                LinearLayout.LayoutParams pLp = new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.WRAP_CONTENT, dp(38));
                pLp.setMargins(dp(4), 0, dp(4), 0);
                p.setOnClickListener(v -> {
                    quantity = val;
                    render();
                });
                quickRow.addView(p, pLp);
            }
        }
        body.addView(quickRow);

        Button confirmBtn = makeButton("Zatwierdź wydanie RW (" + quantity + " " + currentIndex.unit + ")",
                "#16A34A", "#FFFFFF", 15);
        LinearLayout.LayoutParams cLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(52));
        cLp.topMargin = dp(20);
        confirmBtn.setOnClickListener(v -> submitRw());
        body.addView(confirmBtn, cLp);
    }

    private void renderSuccessScreen(LinearLayout body) {
        if (lastRw == null || currentIndex == null || selectedOrder == null) return;

        LinearLayout card = makeCard("#111726", "#22C55E");
        TextView title = new TextView(this);
        title.setText("Rozchód zatwierdzony!");
        title.setTextColor(Color.parseColor("#22C55E"));
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 19);
        title.setTypeface(null, Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        card.addView(title);

        TextView doc = new TextView(this);
        doc.setText(lastRw.number);
        doc.setTextColor(Color.parseColor("#F8FAFC"));
        doc.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        doc.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        doc.setGravity(Gravity.CENTER);
        doc.setPadding(0, dp(6), 0, dp(10));
        card.addView(doc);

        TextView details = new TextView(this);
        details.setText("Indeks: " + currentIndex.sku + "\nWydano: " + quantity + " " + currentIndex.unit
                + "\nZlecenie: " + selectedOrder.orderNumber);
        details.setTextColor(Color.parseColor("#CBD5E1"));
        details.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        details.setGravity(Gravity.CENTER);
        card.addView(details);

        body.addView(card);

        Button nextBtn = makeButton("Skanuj kolejny indeks", "#2563EB", "#FFFFFF", 15);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(50));
        lp.topMargin = dp(16);
        nextBtn.setOnClickListener(v -> {
            step = Step.SCAN;
            errorMessage = null;
            render();
        });
        body.addView(nextBtn, lp);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private LinearLayout makeCard(String bgHex, String borderHex) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        int pad = dp(16);
        card.setPadding(pad, pad, pad, pad);
        GradientDrawable gd = new GradientDrawable();
        gd.setColor(Color.parseColor(bgHex));
        gd.setStroke(dp(1), Color.parseColor(borderHex));
        gd.setCornerRadius(dp(12));
        card.setBackground(gd);
        return card;
    }

    private Button makeButton(String text, String bgHex, String textHex, int sp) {
        Button b = new Button(this);
        b.setText(text);
        b.setAllCaps(false);
        b.setTextColor(Color.parseColor(textHex));
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        b.setTypeface(null, Typeface.BOLD);
        GradientDrawable gd = new GradientDrawable();
        gd.setColor(Color.parseColor(bgHex));
        gd.setCornerRadius(dp(10));
        b.setBackground(gd);
        return b;
    }

    private EditText makeInput(String hint) {
        EditText et = new EditText(this);
        et.setHint(hint);
        et.setHintTextColor(Color.parseColor("#64748B"));
        et.setTextColor(Color.parseColor("#F8FAFC"));
        et.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        et.setSingleLine(true);
        et.setPadding(dp(12), dp(10), dp(12), dp(10));
        GradientDrawable gd = new GradientDrawable();
        gd.setColor(Color.parseColor("#141B2D"));
        gd.setStroke(dp(1), Color.parseColor("#334155"));
        gd.setCornerRadius(dp(8));
        et.setBackground(gd);
        return et;
    }

    private View buildErrorBanner(String msg) {
        TextView tv = new TextView(this);
        tv.setText(msg);
        tv.setTextColor(Color.parseColor("#FCA5A5"));
        tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        int pad = dp(10);
        tv.setPadding(pad, pad, pad, pad);
        GradientDrawable gd = new GradientDrawable();
        gd.setColor(Color.parseColor("#3F1D24"));
        gd.setStroke(dp(1), Color.parseColor("#EF4444"));
        gd.setCornerRadius(dp(8));
        tv.setBackground(gd);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.bottomMargin = dp(12);
        tv.setLayoutParams(lp);
        return tv;
    }

    private int dp(int val) {
        return Math.round(TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, val, getResources().getDisplayMetrics()));
    }
}
