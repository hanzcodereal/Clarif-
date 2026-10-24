const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@napi-rs/canvas', 'form-data']
  }
};

module.exports = nextConfig;