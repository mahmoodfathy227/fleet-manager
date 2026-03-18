# Deployment Troubleshooting Guide

## 502 Bad Gateway (nginx)

A **502 Bad Gateway** means nginx could not get a valid response from your app (e.g. Next.js). The app is either not running, crashing, or not reachable on the port nginx expects.

### 1. Check that the app is running

```bash
# If using PM2
pm2 list
pm2 logs

# Start or restart the app (e.g. Next.js on port 3000)
cd /path/to/your/app
npm run build
pm2 start npm --name "fleet" -- start
# or: node .next/standalone/server.js (if using standalone output)
```

### 2. Confirm the app listens on the port nginx uses

Your nginx config should have `proxy_pass http://localhost:3000` (or your app port). Next.js by default runs on **3000**. Check nothing else is using that port and the app is bound to `0.0.0.0` or `localhost`:

```bash
# See what is listening on 3000
# Linux:
ss -tlnp | grep 3000
# or
netstat -tlnp | grep 3000
```

### 3. Check nginx and app logs

```bash
# Nginx (why it returned 502)
tail -50 /var/log/nginx/error.log

# App (crashes / startup errors)
pm2 logs
# or journalctl if using systemd
```

### 4. Restart app and nginx

```bash
pm2 restart all
sudo systemctl restart nginx
```

### 5. Increase timeouts (if the app is slow to respond)

In your nginx `server` or `location /` block:

```nginx
proxy_connect_timeout 60s;
proxy_send_timeout 60s;
proxy_read_timeout 60s;
```

### Common causes of 502

- Next.js (or Node) process not running or crashed
- App listening on a different port than nginx `proxy_pass`
- App failed to start (e.g. missing env vars, build errors)
- Firewall or permissions blocking localhost connection
- Out of memory (process killed)

---

## 400 Bad Request Errors for Static Assets

If you're seeing errors like:
```
GET https://senfleetmanager.com/_next/static/chunks/webpack-*.js net::ERR_ABORTED 400 (Bad Request)
GET https://senfleetmanager.com/_next/static/css/*.css net::ERR_ABORTED 400 (Bad Request)
```

This is typically a **server configuration issue**, not a code issue. Here are the steps to fix it:

### 1. Verify Build Output

Ensure the `.next` folder is properly built and deployed:

```bash
npm run build
```

Check that the `.next/static` folder exists and contains the files.

### 2. Nginx Configuration

If using Nginx, ensure your configuration includes:

```nginx
server {
    listen 80;
    server_name senfleetmanager.com;

    # Root directory
    root /path/to/your/app;
    index index.html;

    # Next.js static files
    location /_next/static/ {
        alias /path/to/your/app/.next/static/;
        expires 365d;
        add_header Cache-Control "public, immutable";
        # Ensure proper MIME types
        location ~* \.(js|mjs)$ {
            add_header Content-Type "application/javascript; charset=utf-8";
        }
        location ~* \.css$ {
            add_header Content-Type "text/css; charset=utf-8";
        }
    }

    # Next.js server
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. Apache Configuration

If using Apache, add to your `.htaccess` or virtual host:

```apache
<Directory "/path/to/your/app/.next/static">
    Options -Indexes
    AllowOverride None
    Require all granted
</Directory>

# Ensure proper MIME types
<FilesMatch "\.(js|mjs)$">
    Header set Content-Type "application/javascript; charset=utf-8"
</FilesMatch>

<FilesMatch "\.css$">
    Header set Content-Type "text/css; charset=utf-8"
</FilesMatch>
```

### 4. PM2 / Process Manager

If running with PM2, ensure the app is running:

```bash
pm2 list
pm2 restart all
```

### 5. File Permissions

Ensure the `.next` folder has proper permissions:

```bash
chmod -R 755 .next
chown -R www-data:www-data .next  # Adjust user/group as needed
```

### 6. Check Server Logs

Check your server error logs for more details:

```bash
# Nginx
tail -f /var/log/nginx/error.log

# Apache
tail -f /var/log/apache2/error.log

# PM2
pm2 logs
```

### 7. Verify Domain Configuration

Ensure your domain `senfleetmanager.com` is:
- Properly pointing to your server IP
- SSL certificate is valid (if using HTTPS)
- DNS propagation is complete

### 8. Quick Test

Test if static files are accessible directly:

```bash
curl -I https://senfleetmanager.com/_next/static/chunks/webpack-*.js
```

This should return a `200 OK` status, not `400 Bad Request`.

### 9. Rebuild and Redeploy

If the issue persists:

```bash
# Clean build
rm -rf .next
npm run build

# Restart server
pm2 restart all
# or
systemctl restart nginx
```

### Common Causes

1. **Missing MIME types** - Server doesn't recognize `.js` or `.css` files
2. **Incorrect file permissions** - Server can't read the files
3. **Wrong document root** - Server is looking in the wrong directory
4. **Proxy misconfiguration** - Reverse proxy is blocking or misrouting requests
5. **Missing `.next` folder** - Build output wasn't deployed

### Still Having Issues?

1. Check browser console for exact error messages
2. Check server access/error logs
3. Verify the `.next/static` folder exists and is accessible
4. Test with a simple static file to isolate the issue
5. Ensure Next.js is running on the correct port and accessible

