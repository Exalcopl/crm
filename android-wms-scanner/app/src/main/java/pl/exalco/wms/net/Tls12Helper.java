package pl.exalco.wms.net;

import android.content.Context;
import java.io.InputStream;
import java.security.KeyStore;
import java.security.Provider;
import java.security.Security;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.TrustManagerFactory;
import javax.net.ssl.X509TrustManager;
import okhttp3.OkHttpClient;
import org.conscrypt.Conscrypt;

/**
 * Konfiguruje nowoczesny stos TLS (BoringSSL przez Conscrypt) oraz aktualną bazę certyfikatów CA
 * (Mozilla cacert.pem) dla Androida 4.4.3 (API 19), którego wbudowany OpenSSL 1.0.1e
 * nie obsługuje współczesnych szyfrów TLS 1.2/1.3 i nowych certyfikatów głównych.
 */
public final class Tls12Helper {
    private Tls12Helper() {}

    public static OkHttpClient.Builder enableTls12(Context context, OkHttpClient.Builder builder) {
        try {
            Provider conscrypt = Conscrypt.newProvider();
            if (Security.getProvider(conscrypt.getName()) == null) {
                Security.insertProviderAt(conscrypt, 1);
            }

            X509TrustManager trustManager = buildCombinedTrustManager(context);
            SSLContext sc = SSLContext.getInstance("TLS", conscrypt);
            sc.init(null, new TrustManager[]{trustManager}, null);
            builder.sslSocketFactory(sc.getSocketFactory(), trustManager);
        } catch (Exception ignored) {
            // Fallback do domyślnej konfiguracji OkHttp
        }
        return builder;
    }

    private static X509TrustManager buildCombinedTrustManager(Context context) throws Exception {
        TrustManagerFactory sysTmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
        sysTmf.init((KeyStore) null);
        final X509TrustManager sysTm = findX509TrustManager(sysTmf);

        X509TrustManager extraTm = null;
        int rawId = context.getResources().getIdentifier("cacert", "raw", context.getPackageName());
        if (rawId != 0) {
            try (InputStream is = context.getResources().openRawResource(rawId)) {
                CertificateFactory cf = CertificateFactory.getInstance("X.509");
                Collection<? extends Certificate> certs = cf.generateCertificates(is);
                KeyStore ks = KeyStore.getInstance(KeyStore.getDefaultType());
                ks.load(null, null);
                int idx = 0;
                for (Certificate ca : certs) {
                    ks.setCertificateEntry("ca_" + (idx++), ca);
                }

                TrustManagerFactory extraTmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
                extraTmf.init(ks);
                extraTm = findX509TrustManager(extraTmf);
            }
        }

        final X509TrustManager customTm = extraTm;
        return new X509TrustManager() {
            @Override
            public void checkClientTrusted(X509Certificate[] chain, String authType) throws java.security.cert.CertificateException {
                sysTm.checkClientTrusted(chain, authType);
            }

            @Override
            public void checkServerTrusted(X509Certificate[] chain, String authType) throws java.security.cert.CertificateException {
                if (customTm != null) {
                    try {
                        customTm.checkServerTrusted(chain, authType);
                        return;
                    } catch (java.security.cert.CertificateException ignored) {
                        // Fallback do systemowego TrustManagera
                    }
                }
                sysTm.checkServerTrusted(chain, authType);
            }

            @Override
            public X509Certificate[] getAcceptedIssuers() {
                List<X509Certificate> all = new ArrayList<>();
                if (customTm != null) {
                    Collections.addAll(all, customTm.getAcceptedIssuers());
                }
                Collections.addAll(all, sysTm.getAcceptedIssuers());
                return all.toArray(new X509Certificate[0]);
            }
        };
    }

    private static X509TrustManager findX509TrustManager(TrustManagerFactory tmf) {
        for (TrustManager tm : tmf.getTrustManagers()) {
            if (tm instanceof X509TrustManager) {
                return (X509TrustManager) tm;
            }
        }
        throw new IllegalStateException("No X509TrustManager found");
    }
}
