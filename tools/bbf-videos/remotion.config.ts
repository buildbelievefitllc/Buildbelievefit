// Remotion render/preview config for the BBF video project.
// Codec is set per-command (see package.json scripts / CLI).
import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// Single-tab rendering keeps headless Chrome stable in constrained CI/sandbox
// containers (150 frames renders fast regardless).
Config.setConcurrency(1);
