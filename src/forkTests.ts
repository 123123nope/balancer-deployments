import hre from 'hardhat';
import chalk from 'chalk';

import { HttpNetworkConfig, HardhatNetworkConfig } from 'hardhat/types';
import { Network } from './types';

export function describeForkTest(name: string, forkNetwork: Network, blockNumber: number, callback: () => void): void {
  describe(name, function () {
    // Retrying is useful in CI, where the tests may fail when hitting request rate limits.
    if (process.env.CI) {
      this.retries(2);

      // Delay between retries (only if the attempt fails)
      afterEach(async function () {
        if (this.currentTest?.state === undefined) {
          const delay = 5000;
          const formattedMessage = chalk.keyword('yellow')(
            `⚠️   Test '${this.currentTest?.title}' failed, retrying in ${delay}ms`
          );
          console.warn(formattedMessage);

          // Block event loop to ensure no requests are sent to the RPC.
          const date = Date.now();
          let currentDate = null;
          do {
            currentDate = Date.now();
          } while (currentDate - date < 5000);
        }
      });
    }

    _describeBody(forkNetwork, blockNumber, callback);
  });
}

describeForkTest.only = function (name: string, forkNetwork: Network, blockNumber: number, callback: () => void): void {
  // eslint-disable-next-line mocha-no-only/mocha-no-only
  describe.only(name, () => {
    _describeBody(forkNetwork, blockNumber, callback);
  });
};

describeForkTest.skip = function (name: string, forkNetwork: Network, blockNumber: number, callback: () => void): void {
  describe.skip(name, () => {
    _describeBody(forkNetwork, blockNumber, callback);
  });
};

function _describeBody(forkNetwork: Network, blockNumber: number, callback: () => void) {
  before('setup fork test', async () => {
    const forkingNetworkName = Object.keys(hre.config.networks).find((networkName) => networkName === forkNetwork);
    if (!forkingNetworkName) throw Error(`Could not find a config for network ${forkNetwork} to be forked`);

    const forkingNetworkConfig = hre.config.networks[forkingNetworkName] as HttpNetworkConfig;
    if (!forkingNetworkConfig.url) throw Error(`Could not find a RPC url in network config for ${forkingNetworkName}`);

    await hre.network.provider.request({
      method: 'hardhat_reset',
      params: [{ forking: { jsonRpcUrl: forkingNetworkConfig.url, blockNumber } }],
    });

    const config = hre.network.config as HardhatNetworkConfig;
    config.forking = { enabled: true, blockNumber, url: forkingNetworkConfig.url, httpHeaders: {} };
  });
  callback();
}
