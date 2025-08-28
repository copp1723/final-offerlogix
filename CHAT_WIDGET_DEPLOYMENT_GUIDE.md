# OfferLogix Chat Widget - Deployment Guide

## 🚀 Live Deployment

The OfferLogix Chat Widget is now **LIVE** on Render! 

### **Demo & Testing**
- **Demo Page**: https://final-offerlogix.onrender.com/chat-widget-demo.html
- **Widget Script**: https://final-offerlogix.onrender.com/offerlogix-chat-widget.js

---

## 📋 Quick Integration

### **Basic Setup (Recommended)**
Add this script tag to any website:

```html
<script 
    src="https://final-offerlogix.onrender.com/offerlogix-chat-widget.js" 
    data-offerlogix-campaign-id="your-campaign-id"
    data-offerlogix-api-url="https://final-offerlogix.onrender.com"
    data-offerlogix-position="bottom-right">
</script>
```

### **Advanced Configuration**
```html
<script 
    src="https://final-offerlogix.onrender.com/offerlogix-chat-widget.js" 
    data-offerlogix-campaign-id="campaign-123"
    data-offerlogix-api-url="https://final-offerlogix.onrender.com"
    data-offerlogix-position="bottom-right"
    data-offerlogix-theme="default"
    data-offerlogix-auto-open="false"
    data-offerlogix-auto-open-delay="5000"
    data-offerlogix-debug="false">
</script>
```

---

## ⚙️ Configuration Options

| Parameter | Description | Default | Options |
|-----------|-------------|---------|---------|
| `data-offerlogix-campaign-id` | **Required**: Your campaign ID | - | Any string |
| `data-offerlogix-api-url` | API endpoint | Current domain | Any URL |
| `data-offerlogix-position` | Widget position | `bottom-right` | `bottom-right`, `bottom-left`, `top-right`, `top-left` |
| `data-offerlogix-theme` | Visual theme | `default` | `default`, `dark` |
| `data-offerlogix-auto-open` | Auto-open chat | `false` | `true`, `false` |
| `data-offerlogix-auto-open-delay` | Auto-open delay (ms) | `5000` | Any number |
| `data-offerlogix-debug` | Debug logging | `false` | `true`, `false` |

---

## 🔌 JavaScript API

### **Check Widget Status**
```javascript
if (window.OfferLogixChat && window.OfferLogixChat.isReady()) {
    console.log('Chat widget is ready!');
}
```

### **Control Widget**
```javascript
// Open chat
window.OfferLogixChat.open();

// Close chat
window.OfferLogixChat.close();

// Minimize chat
window.OfferLogixChat.minimize();

// Send message programmatically
window.OfferLogixChat.sendUserMessage("Hello, I need help!");
```

### **Listen for Events**
```javascript
// Widget ready event
window.addEventListener('offerLogixChatReady', function(event) {
    console.log('Chat widget loaded!', event.detail.widget);
});
```

---

## 🎨 Integration Examples

### **WordPress**
Add to your theme's `footer.php` or use a plugin like "Insert Headers and Footers":

```html
<script 
    src="https://final-offerlogix.onrender.com/offerlogix-chat-widget.js" 
    data-offerlogix-campaign-id="<?php echo get_option('offerlogix_campaign_id', 'default-campaign'); ?>"
    data-offerlogix-api-url="https://final-offerlogix.onrender.com">
</script>
```

### **Shopify**
Add to `theme.liquid` before the closing `</body>` tag:

```html
<script 
    src="https://final-offerlogix.onrender.com/offerlogix-chat-widget.js" 
    data-offerlogix-campaign-id="{{ shop.metafields.offerlogix.campaign_id | default: 'shopify-store' }}"
    data-offerlogix-api-url="https://final-offerlogix.onrender.com">
</script>
```

### **React/Next.js**
```jsx
import { useEffect } from 'react';

export default function ChatWidget({ campaignId }) {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://final-offerlogix.onrender.com/offerlogix-chat-widget.js';
    script.setAttribute('data-offerlogix-campaign-id', campaignId);
    script.setAttribute('data-offerlogix-api-url', 'https://final-offerlogix.onrender.com');
    
    document.body.appendChild(script);
    
    return () => {
      document.body.removeChild(script);
      const widget = document.getElementById('offerlogix-chat-widget');
      if (widget) widget.remove();
    };
  }, [campaignId]);

  return null;
}
```

### **Google Tag Manager**
1. Create a new **Custom HTML** tag
2. Add this code:
```html
<script 
    src="https://final-offerlogix.onrender.com/offerlogix-chat-widget.js" 
    data-offerlogix-campaign-id="{{Campaign ID Variable}}"
    data-offerlogix-api-url="https://final-offerlogix.onrender.com">
</script>
```
3. Set trigger to **All Pages** or specific pages
4. Publish the container

---

## 🔧 Customization

### **Custom Styling**
The widget uses Shadow DOM for style isolation. To customize:

```javascript
// Wait for widget to load
window.addEventListener('offerLogixChatReady', function() {
    // Access the widget container
    const widget = document.getElementById('offerlogix-chat-widget');
    
    // Add custom CSS classes to the container
    widget.classList.add('my-custom-widget');
});
```

### **Dynamic Campaign Assignment**
```javascript
// Set campaign based on page or user data
const campaignId = window.location.pathname.includes('/cars/') 
    ? 'automotive-campaign' 
    : 'general-campaign';

// Load widget dynamically
const script = document.createElement('script');
script.src = 'https://final-offerlogix.onrender.com/offerlogix-chat-widget.js';
script.setAttribute('data-offerlogix-campaign-id', campaignId);
script.setAttribute('data-offerlogix-api-url', 'https://final-offerlogix.onrender.com');
document.body.appendChild(script);
```

---

## 📊 Analytics Integration

### **Google Analytics 4**
```javascript
window.addEventListener('offerLogixChatReady', function() {
    // Track widget load
    gtag('event', 'offerlogix_widget_loaded', {
        'custom_parameter': 'chat_widget'
    });
});

// Track when users open chat (add this to your page)
window.addEventListener('click', function(e) {
    if (e.target.closest('#offerlogix-chat-widget')) {
        gtag('event', 'offerlogix_chat_opened', {
            'engagement_time_msec': Date.now()
        });
    }
});
```

### **Facebook Pixel**
```javascript
window.addEventListener('offerLogixChatReady', function() {
    fbq('track', 'ViewContent', {
        content_name: 'OfferLogix Chat Widget',
        content_category: 'Chat'
    });
});
```

---

## 🛠️ Troubleshooting

### **Common Issues**

**Widget doesn't appear:**
- Check browser console for errors
- Verify the campaign ID is valid
- Ensure the script URL is accessible

**Widget loads but doesn't respond:**
- Check network tab for API errors
- Verify the API URL is correct
- Check if CORS is properly configured

**Styling conflicts:**
- The widget uses Shadow DOM for isolation
- Check for global CSS that might affect positioning
- Use browser dev tools to inspect the widget container

### **Debug Mode**
Enable debug logging:
```html
<script 
    src="https://final-offerlogix.onrender.com/offerlogix-chat-widget.js" 
    data-offerlogix-campaign-id="your-campaign"
    data-offerlogix-debug="true">
</script>
```

---

## 📞 Support

For technical support or custom implementations:
- Check the demo page for examples
- Review browser console for error messages
- Test with different campaign IDs
- Verify network connectivity to the API

---

## 🔄 Updates

The chat widget is automatically updated on the server. No client-side changes needed for:
- Bug fixes
- Security updates
- Feature enhancements
- UI improvements

For major changes, we'll provide migration guides and backward compatibility.

---

**Ready to go live? Copy the script tag and start engaging your visitors with AI-powered conversations!**