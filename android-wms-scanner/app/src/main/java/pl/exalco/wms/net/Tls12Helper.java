package pl.exalco.wms.net;

import android.content.Context;
import android.os.Build;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.Socket;
import java.security.KeyStore;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManager;
import javax.net.ssl.TrustManagerFactory;
import javax.net.ssl.X509TrustManager;
import okhttp3.ConnectionSpec;
import okhttp3.OkHttpClient;
import okhttp3.TlsVersion;

/**
 * Wymusza TLS 1.2 na Androidzie 4.4 (API 19) i dodaje obsługę certyfikatu ISRG Root X1
 * (Let's Encrypt) obok systemowych certyfikatów Androida.
 */
public final class Tls12Helper {
    private static final String[] TLS_12_PROTOCOLS = {"TLSv1.2"};

    private Tls12Helper() {}

    public static OkHttpClient.Builder enableTls12(Context context, OkHttpClient.Builder builder) {
        if (Build.VERSION.SDK_INT >= 16 && Build.VERSION.SDK_INT < 22) {
            try {
                X509TrustManager trustManager = buildCombinedTrustManager(context);
                SSLContext sc = SSLContext.getInstance("TLSv1.2");
                sc.init(null, new TrustManager[]{trustManager}, null);
                builder.sslSocketFactory(new Tls12SocketFactory(sc.getSocketFactory()), trustManager);

                ConnectionSpec cs = new ConnectionSpec.Builder(ConnectionSpec.MODERN_TLS)
                        .tlsVersions(TlsVersion.TLS_1_2)
                        .build();
                List<ConnectionSpec> specs = new ArrayList<>();
                specs.add(cs);
                specs.add(ConnectionSpec.COMPATIBLE_TLS);
                specs.add(ConnectionSpec.CLEARTEXT);
                builder.connectionSpecs(specs);
            } catch (Exception ignored) {
                // Fallback do domyślnej konfiguracji OkHttp
            }
        }
        return builder;
    }

    private static X509TrustManager buildCombinedTrustManager(Context context) throws Exception {
        TrustManagerFactory sysTmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
        sysTmf.init((KeyStore) null);
        final X509TrustManager sysTm = findX509TrustManager(sysTmf);

        X509TrustManager extraTm = null;
        int rawId = context.getResources().getIdentifier("isrg_root_x1", "raw", context.getPackageName());
        if (rawId != 0) {
            try (InputStream is = context.getResources().openRawResource(rawId)) {
                CertificateFactory cf = CertificateFactory.getInstance("X.509");
                Certificate ca = cf.generateCertificate(is);
                KeyStore ks = KeyStore.getInstance(KeyStore.getDefaultType());
                ks.load(null, null);
                ks.setCertificateEntry("isrg_root_x1", ca);

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
                try {
                    sysTm.checkServerTrusted(chain, authType);
                } catch (java.security.cert.CertificateException sysErr) {
                    if (customTm != null) {
                        customTm.checkServerTrusted(chain, authType);
                    } else {
                        throw sysErr;
                    }
                }
            }

            @Override
            public X509Certificate[] getAcceptedIssuers() {
                List<X509Certificate> all = new ArrayList<>();
                Collections.addAll(all, sysTm.getAcceptedIssuers());
                if (customTm != null) {
                    Collections.addAll(all, customTm.getAcceptedIssuers());
                }
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

    private static class Tls12SocketFactory extends SSLSocketFactory {
        private final SSLSocketFactory delegate;

        Tls12SocketFactory(SSLSocketFactory delegate) {
            this.delegate = delegate;
        }

        @Override public String[] getDefaultCipherSuites() { return delegate.getDefaultCipherSuites(); }
        @Override public String[] getSupportedCipherSuites() { return delegate.getSupportedCipherSuites(); }

        @Override
        public Socket createSocket(Socket s, String host, int port, boolean autoClose) throws IOException {
            return patch(delegate.createSocket(s, host, port, autoClose));
        }

        @Override
        public Socket createSocket(String host, int port) throws IOException {
            return patch(delegate.createSocket(host, port));
        }

        @Override
        public Socket createSocket(String host, int port, InetAddress localHost, int localPort) throws IOException {
            return patch(delegate.createSocket(host, port, localHost, localPort));
        }

        @Override
        public Socket createSocket(InetAddress host, int port) throws IOException {
            return patch(delegate.createSocket(host, port));
        }

        @Override
        public Socket createSocket(InetAddress address, int port, InetAddress localAddress, int localPort) throws IOException {
            return patch(delegate.createSocket(address, port, localAddress, localPort));
        }

        private Socket patch(Socket s) {
            if (s instanceof SSLSocket) {
                ((SSLSocket) s).setEnabledProtocols(TLS_12_PROTOCOLS);
            }
            return s;
        }
    }
}
