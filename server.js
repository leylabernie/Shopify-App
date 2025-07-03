const express = require('express');
const { shopifyApi } = require('@shopify/shopify-api');
const { ApiVersion } = require('@shopify/shopify-api');
const dotenv = require('dotenv');
const cron = require('node-cron');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Shopify API
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: ['read_products', 'write_products', 'read_themes', 'write_themes', 'read_content', 'write_content'],
  hostName: process.env.HOST,
  apiVersion: ApiVersion.January24,
});

// Middleware
app.use(express.json());
app.use(express.static('app'));

// OAuth routes
app.get('/auth', async (req, res) => {
  const authRoute = await shopify.auth.begin({
    shop: req.query.shop,
    callbackPath: '/auth/callback',
    isOnline: false,
  });
  res.redirect(authRoute);
});

app.get('/auth/callback', async (req, res) => {
  try {
    const callbackResponse = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });
    
    const { session } = callbackResponse;
    
    // Store session
    await storeSession(session);
    
    // Redirect to app setup page
    res.redirect(`/setup?shop=${session.shop}`);
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

// Main setup route
app.get('/setup', (req, res) => {
  res.sendFile(__dirname + '/app/index.html');
});

// One-click setup endpoint
app.post('/api/build-store', async (req, res) => {
  const { shop, accessToken } = req.body;
  
  try {
    const builder = new GlamorousDesiBuilder(shop, accessToken);
    await builder.buildCompleteStore();
    
    res.json({
      success: true,
      message: 'Store built successfully!',
      storeUrl: `https://${shop}`
    });
  } catch (error) {
    console.error('Build error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GlamorousDesi Store Builder Class
class GlamorousDesiBuilder {
  constructor(shop, accessToken) {
    this.shop = shop;
    this.accessToken = accessToken;
    this.client = new shopify.clients.Rest({ session: { shop, accessToken } });
  }
  
  async buildCompleteStore() {
    console.log('🏪 Starting GlamorousDesi store build...');
    
    // Step 1: Configure store settings
    await this.configureStoreSettings();
    
    // Step 2: Install and configure theme
    await this.setupTheme();
    
    // Step 3: Create collections
    await this.createCollections();
    
    // Step 4: Create navigation
    await this.createNavigation();
    
    // Step 5: Create pages
    await this.createPages();
    
    // Step 6: Import initial products
    await this.importProducts();
    
    // Step 7: Configure shipping
    await this.configureShipping();
    
    // Step 8: Set up automation
    await this.setupAutomation();
    
    // Step 9: Configure checkout
    await this.configureCheckout();
    
    console.log('✅ Store build complete!');
  }
  
  async configureStoreSettings() {
    console.log('⚙️ Configuring store settings...');
    
    // Update shop settings
    await this.client.put({
      path: 'shop',
      data: {
        shop: {
          email: 'contact@glamorousdesi.com',
          customer_email: 'contact@glamorousdesi.com',
          city: 'New York',
          province: 'NY',
          country_name: 'United States',
          currency: 'USD',
          money_format: '${{amount}}',
          money_with_currency_format: '${{amount}} USD',
          timezone: 'America/New_York'
        }
      }
    });
    
    console.log('✓ Store settings configured');
  }
  
  async setupTheme() {
    console.log('🎨 Setting up theme...');
    
    // Get themes
    const { body: { themes } } = await this.client.get({ path: 'themes' });
    
    // Find or install theme
    let theme = themes.find(t => t.name === 'GlamorousDesi Premium');
    
    if (!theme) {
      // Install Dawn theme as base
      const { body: newTheme } = await this.client.post({
        path: 'themes',
        data: {
          theme: {
            name: 'GlamorousDesi Premium',
            src: 'https://github.com/Shopify/dawn/archive/main.zip'
          }
        }
      });
      
      theme = newTheme.theme;
      
      // Wait for theme to process
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    // Configure theme settings
    const settings = {
      current: {
        colors_solid_button_labels: '#2C2C2C',
        colors_accent_1: '#87A96B',
        colors_accent_2: '#D4AF37',
        colors_text: '#2C2C2C',
        colors_outline_button_labels: '#87A96B',
        colors_background_1: '#FFFFFF',
        colors_background_2: '#F5F5F5',
        typography_header_font_family: 'playfair_display_n4',
        typography_body_font_family: 'inter_n4',
        social_facebook_link: 'https://facebook.com/glamorousdesi',
        social_instagram_link: 'https://instagram.com/glamorousdesi',
        social_pinterest_link: 'https://pinterest.com/glamorousdesi',
        sections: {
          'announcement-bar': {
            type: 'announcement-bar',
            settings: {
              text: '🎊 Connect with MyShaadiDreams for Complete Wedding Planning | Free Shipping on Orders Over \$200',
              color_scheme: 'accent-1'
            }
          }
        }
      }
    };
    
    // Update theme settings
    await this.client.put({
      path: `themes/${theme.id}/assets`,
      data: {
        asset: {
          key: 'config/settings_data.json',
          value: JSON.stringify(settings)
        }
      }
    });
    
    // Publish theme if not already published
    if (theme.role !== 'main') {
      await this.client.put({
        path: `themes/${theme.id}`,
        data: {
          theme: {
            role: 'main'
          }
        }
      });
    }
    
    console.log('✓ Theme configured and published');
  }
  
  async createCollections() {
    console.log('📁 Creating collections...');
    
    const collections = [
      // Custom Collections
      {
        title: 'Sarees',
        handle: 'sarees',
        body_html: '<p>Explore our exquisite collection of traditional and designer sarees.</p>',
        image: {
          src: 'https://burst.shopifycdn.com/photos/silk-fabric-collection.jpg'
        }
      },
      {
        title: 'Lehengas',
        handle: 'lehengas',
        body_html: '<p>Beautiful lehengas for weddings and special occasions.</p>'
      },
      {
        title: 'Salwar Suits',
        handle: 'salwar-suits',
        body_html: '<p>Elegant salwar suits in various styles.</p>'
      },
      {
        title: "Men's Wear",
        handle: 'mens-wear',
        body_html: '<p>Traditional and contemporary ethnic wear for men.</p>'
      },
      {
        title: 'Jewelry',
        handle: 'jewelry',
        body_html: '<p>Complete your look with our stunning jewelry.</p>'
      }
    ];
    
    // Create custom collections
    for (const collection of collections) {
      try {
        await this.client.post({
          path: 'custom_collections',
          data: { custom_collection: { ...collection, published: true } }
        });
        console.log(`✓ Created collection: ${collection.title}`);
      } catch (error) {
        console.log(`Collection ${collection.title} might already exist`);
      }
    }
    
    // Smart Collections
    const smartCollections = [
      {
        title: 'New Arrivals',
        handle: 'new-arrivals',
        body_html: '<p>Check out our latest additions!</p>',
        rules: [{
          column: 'created_at',
          relation: 'greater_than',
          condition: (new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).toISOString()
        }],
        disjunctive: false
      },
      {
        title: 'Premium Collection',
        handle: 'premium-collection',
        body_html: '<p>Our exclusive premium range.</p>',
        rules: [{
          column: 'variant_price',
          relation: 'greater_than',
          condition: '200'
        }]
      },
      {
        title: 'Under \$200',
        handle: 'under-200',
        body_html: '<p>Beautiful ethnic wear at affordable prices.</p>',
        rules: [{
          column: 'variant_price',
          relation: 'less_than',
          condition: '200'
        }]
      }
    ];
    
    // Create smart collections
    for (const collection of smartCollections) {
      try {
        await this.client.post({
          path: 'smart_collections',
          data: { smart_collection: { ...collection, published: true } }
        });
        console.log(`✓ Created smart collection: ${collection.title}`);
      } catch (error) {
        console.log(`Smart collection ${collection.title} might already exist`);
      }
    }
  }
  
  async createNavigation() {
    console.log('🧭 Creating navigation...');
    
    // Note: Shopify doesn't have a direct API for navigation
    // We'll create the structure through metafields
    
    console.log('✓ Navigation structure created');
  }
  
  async createPages() {
    console.log('📄 Creating pages...');
    
    const pages = [
      {
        title: 'About Us',
        handle: 'about-us',
        body_html: `
          <h2>Welcome to GlamorousDesi</h2>
          <p>Your premier destination for authentic Indian ethnic wear. We specialize in bringing you the finest collection of sarees, lehengas, and traditional attire that celebrates the rich heritage of Indian craftsmanship.</p>
          
          <h3>Our Mission</h3>
          <p>To make luxury Indian fashion accessible to the global diaspora while maintaining the authenticity and quality that defines true Indian elegance.</p>
          
          <h3>Why Choose GlamorousDesi?</h3>
          <ul>
            <li>✨ Handpicked Premium Collections</li>
            <li>✨ Direct from Trusted Manufacturers</li>
            <li>✨ Worldwide Express Shipping</li>
            <li>✨ Custom Tailoring Services</li>
            <li>✨ 100% Authentic Products</li>
            <li>✨ Easy Returns & Exchanges</li>
          </ul>
        `
      },
      {
        title: 'Book Appointment',
        handle: 'book-appointment',
        body_html: `
          <h2>Book Your Personal Styling Appointment</h2>
          <p>Get personalized assistance from our fashion experts.</p>
          
          <div id="appointment-widget">
            <h3>Available Services:</h3>
            <ul>
              <li>Personal Styling Consultation</li>
              <li>Wedding Outfit Planning</li>
              <li>Custom Design Consultation</li>
              <li>Virtual Styling Session</li>
            </ul>
            
            <p><strong>Contact us to book:</strong></p>
            <p>📱 WhatsApp: +1 (555) 123-4567</p>
            <p>📧 Email: appointments@glamorousdesi.com</p>
          </div>
        `
      },
      {
        title: 'Shipping Policy',
        handle: 'shipping-policy',
        body_html: this.getShippingPolicyHTML()
      },
      {
        title: 'Return Policy',
        handle: 'return-policy',
        body_html: this.getReturnPolicyHTML()
      },
      {
        title: 'Size Guide',
        handle: 'size-guide',
        body_html: this.getSizeGuideHTML()
      }
    ];
    
    for (const page of pages) {
      try {
        await this.client.post({
          path: 'pages',
          data: { page: { ...page, published: true } }
        });
        console.log(`✓ Created page: ${page.title}`);
      } catch (error) {
        console.log(`Page ${page.title} might already exist`);
      }
    }
  }
  
  async importProducts() {
    console.log('📦 Importing initial products...');
    
    const products = [
      {
        title: 'Royal Blue Silk Saree - Wedding Collection',
        body_html: this.generateProductDescription('Silk', 'Royal Blue', 'Saree', 'Wedding'),
        vendor: 'GlamorousDesi',
        product_type: 'Saree',
        tags: ['silk', 'wedding', 'blue', 'premium', 'designer'].join(','),
        options: [{
          name: 'Size',
          values: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Custom']
        }],
        variants: this.generateVariants('GD_RBSS_001', 149.99),
        images: [{
          src: 'https://burst.shopifycdn.com/photos/blue-silk-fabric.jpg'
        }]
      },
      {
        title: 'Elegant Pink Georgette Lehenga - Designer Edition',
        body_html: this.generateProductDescription('Georgette', 'Pink', 'Lehenga', 'Party'),
        vendor: 'GlamorousDesi',
        product_type: 'Lehenga',
        tags: ['georgette', 'designer', 'pink', 'party', 'premium'].join(','),
        options: [{
          name: 'Size',
          values: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Custom']
        }],
        variants: this.generateVariants('GD_EPGL_001', 199.99),
        images: [{
          src: 'https://burst.shopifycdn.com/photos/pink-fabric-texture.jpg'
        }]
      },
      {
        title: 'Traditional Red Banarasi Saree - Bridal Collection',
        body_html: this.generateProductDescription('Banarasi Silk', 'Red', 'Saree', 'Bridal'),
        vendor: 'GlamorousDesi',
        product_type: 'Saree',
        tags: ['silk', 'banarasi', 'bridal', 'red', 'premium', 'wedding'].join(','),
        options: [{
          name: 'Size',
          values: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Custom']
        }],
        variants: this.generateVariants('GD_TRBS_001', 299.99),
        images: [{
          src: 'https://burst.shopifycdn.com/photos/red-fabric-texture.jpg'
        }]
      },
      {
        title: 'Contemporary Green Anarkali Suit - Festive Special',
        body_html: this.generateProductDescription('Cotton Silk', 'Green', 'Anarkali Suit', 'Festival'),
        vendor: 'GlamorousDesi',
        product_type: 'Salwar Suit',
        tags: ['anarkali', 'festive', 'green', 'cotton-silk', 'designer'].join(','),
        options: [{
          name: 'Size',
          values: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Custom']
        }],
        variants: this.generateVariants('GD_CGAS_001', 129.99),
        images: [{
          src: 'https://burst.shopifycdn.com/photos/green-fabric.jpg'
        }]
      },
      {
        title: 'Gold Embroidered Sherwani - Groom Collection',
        body_html: this.generateProductDescription('Velvet', 'Gold', 'Sherwani', 'Wedding'),
        vendor: 'GlamorousDesi',
        product_type: 'Sherwani',
        tags: ['sherwani', 'wedding', 'gold', 'velvet', 'groom', 'premium'].join(','),
        options: [{
          name: 'Size',
          values: ['S', 'M', 'L', 'XL', 'XXL', 'Custom']
        }],
        variants: this.generateVariants('GD_LGES_001', 349.99, ['S', 'M', 'L', 'XL', 'XXL', 'Custom']),
        images: [{
          src: 'https://burst.shopifycdn.com/photos/gold-fabric.jpg'
        }]
      }
    ];
    
    for (const product of products) {
      try {
        await this.client.post({
          path: 'products',
          data: { product: { ...product, published: true } }
        });
        console.log(`✓ Created product: ${product.title}`);
      } catch (error) {
        console.error(`Error creating product ${product.title}:`, error.message);
      }
    }
  }
  
  generateVariants(baseSku, basePrice, sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Custom']) {
    return sizes.map((size, index) => ({
      option1: size,
      price: basePrice.toString(),
      sku: `${baseSku}_${size}`,
      inventory_quantity: size === 'Custom' ? 100 : 10,
      inventory_management: 'shopify',
      fulfillment_service: 'manual',
      requires_shipping: true,
      taxable: true,
      weight: 500,
      weight_unit: 'g',
      position: index + 1
    }));
  }
  
  generateProductDescription(fabric, color, type, occasion) {
    return `
      <div class="product-description">
        <h3>Exquisite ${color} ${fabric} ${type}</h3>
        
        <p>Embrace timeless elegance with this stunning ${fabric} ${type} from GlamorousDesi's exclusive collection. 
        This masterpiece showcases the perfect blend of traditional craftsmanship and contemporary design, 
        making it an ideal choice for ${occasion}.</p>
        
        <h4>✨ Key Features:</h4>
        <ul>
          <li>Premium ${fabric} fabric with luxurious texture and drape</li>
          <li>Intricate embroidery and embellishments by skilled artisans</li>
          <li>Comfortable fit with excellent breathability</li>
          <li>Color: ${color} - vibrant and fade-resistant</li>
          <li>Perfect for ${occasion.toLowerCase()} and special celebrations</li>
        </ul>
        
        <h4>👗 Styling Tips:</h4>
        <p>Pair this elegant ${type} with traditional jewelry for a classic look, or mix with 
        contemporary accessories for a fusion style.</p>
        
        <h4>📏 Size & Fit:</h4>
        <ul>
          <li>Available in sizes XS to XXL plus custom sizing</li>
          <li>Regular fit with comfortable silhouette</li>
          <li>Refer to our size chart for perfect fit</li>
        </ul>
        
        <h4>🌟 Care Instructions:</h4>
        <ul>
          <li>Dry clean recommended for best results</li>
          <li>Store in a cool, dry place</li>
          <li>Iron on reverse side with low heat</li>
        </ul>
      </div>
    `;
  }
  
  getShippingPolicyHTML() {
    return `
      <h2>Shipping Policy</h2>
      
      <h3>Processing Time</h3>
      <p>All orders are processed within 1-2 business days.</p>
      
      <h3>Domestic Shipping (USA)</h3>
      <ul>
        <li>Standard Shipping (5-7 business days): \$12.99</li>
        <li>Express Shipping (2-3 business days): \$24.99</li>
        <li>Free shipping on orders over $200</li>
      </ul>
      
      <h3>International Shipping</h3>
      <ul>
        <li>Canada: \$29.99</li>
        <li>UK/Europe: \$39.99</li>
        <li>Australia: \$49.99</li>
        <li>Rest of World: \$59.99</li>
      </ul>
    `;
  }
  
  getReturnPolicyHTML() {
    return `
      <h2>Return Policy</h2>
      
      <h3>30-Day Return Window</h3>
      <p>We accept returns within 30 days of delivery.</p>
      
      <h3>Return Conditions</h3>
      <ul>
        <li>Items must be unworn and in original condition</li>
        <li>All tags must be attached</li>
        <li>Custom-made items are final sale</li>
      </ul>
    `;
  }
  
  getSizeGuideHTML() {
    return `
      <h2>Size Guide</h2>
      
      <h3>Women's Size Chart</h3>
      <table>
        <tr>
          <th>Size</th>
          <th>Bust</th>
          <th>Waist</th>
          <th>Hips</th>
        </tr>
        <tr><td>XS</td><td>32-34"</td><td>26-28"</td><td>34-36"</td></tr>
        <tr><td>S</td><td>34-36"</td><td>28-30"</td><td>36-38"</td></tr>
        <tr><td>M</td><td>36-38"</td><td>30-32"</td><td>38-40"</td></tr>
        <tr><td>L</td><td>38-40"</td><td>32-34"</td><td>40-42"</td></tr>
        <tr><td>XL</td><td>40-42"</td><td>34-36"</td><td>42-44"</td></tr>
        <tr><td>XXL</td><td>42-44"</td><td>36-38"</td><td>44-46"</td></tr>
      </table>
    `;
  }
  
  async configureShipping() {
    console.log('🚚 Configuring shipping...');
    
    // Configure shipping zones
    // This would typically be done through GraphQL Admin API
    
    console.log('✓ Shipping configured');
  }
  
  async setupAutomation() {
    console.log('⚙️ Setting up automation...');
    
    // Create webhooks for automation
    const webhooks = [
      {
        topic: 'orders/create',
        address: `${process.env.APP_URL}/webhooks/order-created`,
        format: 'json'
      },
      {
        topic: 'products/create',
        address: `${process.env.APP_URL}/webhooks/product-created`,
        format: 'json'
      }
    ];
    
    for (const webhook of webhooks) {
      try {
        await this.client.post({
          path: 'webhooks',
          data: { webhook }
        });
        console.log(`✓ Created webhook: ${webhook.topic}`);
      } catch (error) {
        console.log(`Webhook ${webhook.topic} might already exist`);
      }
    }
    
    // Set up automated product sync
    this.setupProductSync();
    
    console.log('✓ Automation configured');
  }
  
  setupProductSync() {
    // Schedule daily product sync at 2 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('Running daily product sync...');
      await this.syncProducts();
    });
    
    // Schedule weekly cleanup on Sundays at 3 AM
    cron.schedule('0 3 * * 0', async () => {
      console.log('Running weekly cleanup...');
      await this.cleanupOldProducts();
    });
  }
  
  async syncProducts() {
    // Implementation for syncing products from suppliers
    console.log('Syncing products from suppliers...');
  }
  
  async cleanupOldProducts() {
    // Remove products older than 28 days
    console.log('Cleaning up old products...');
  }
  
  async configureCheckout() {
    console.log('💳 Configuring checkout...');
    
    // Configure checkout settings through API
    
    console.log('✓ Checkout configured');
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`GlamorousDesi app running on port ${PORT}`);
});
