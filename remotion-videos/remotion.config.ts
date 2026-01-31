import { Config } from '@remotion/cli/config';
import { enableTailwind } from '@remotion/tailwind';

// CRITICAL: Lock to port 9000 (3000=Next.js frontend, 3001=Backend API)
Config.setPort(9000);

// Performance optimizations
Config.setOverwriteOutput(true);
Config.setConcurrency(2); // Limit CPU usage during render

// CRITICAL: Enable Tailwind CSS processing during production render
Config.overrideWebpackConfig((currentConfiguration) => {
  return enableTailwind(currentConfiguration);
});

export default Config;
