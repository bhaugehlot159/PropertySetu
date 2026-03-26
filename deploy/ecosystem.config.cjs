const rawProfile = String(process.env.APP_PROFILE || "legacy").trim().toLowerCase();
const isProfessional = rawProfile === "professional" || rawProfile === "pro";
const appProfile = isProfessional ? "professional" : "legacy";
const defaultPort = isProfessional ? 5200 : 5000;
const appPort = Number(process.env.APP_PORT || process.env.PORT || defaultPort);
const appName = process.env.APP_NAME || (isProfessional ? "propertysetu-pro-app" : "propertysetu-app");
const appScript = process.env.APP_SCRIPT || (isProfessional ? "server/professional-server.js" : "server/server.js");

module.exports = {
  apps: [
    {
      name: appName,
      cwd: process.env.APP_DIR || "/var/www/propertysetu",
      script: appScript,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      time: true,
      env: {
        NODE_ENV: "production",
        APP_PROFILE: appProfile,
        PORT: appPort,
        PRO_PORT: appPort
      },
      env_production: {
        NODE_ENV: "production",
        APP_PROFILE: appProfile,
        PORT: appPort,
        PRO_PORT: appPort
      }
    }
  ]
};
