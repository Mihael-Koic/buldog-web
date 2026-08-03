import DisableDevtool from 'disable-devtool';

DisableDevtool();

DisableDevtool({
    clearLog: true,
    disableMenu: true,
    interval: 100,
    url: "about:blank"
});