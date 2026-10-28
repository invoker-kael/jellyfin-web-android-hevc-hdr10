import 'jquery';
import loading from '../../components/loading/loading';
import { hdrVideoRangeServerSettings } from '../../scripts/androidHdr10';
import Dashboard from '../../utils/dashboard';

function loadPage(page, config) {
    $('.chkHdrVideoRangeEnabled', page).each(function () {
        const settingName = hdrVideoRangeServerSettings[this.dataset.videoRangeType];
        $(this).prop('checked', config[settingName] !== false);
    });
    loading.hide();
}

function onSubmit() {
    loading.show();
    const form = this;
    ApiClient.getServerConfiguration().then(function (config) {
        $('.chkHdrVideoRangeEnabled', form).each(function () {
            const settingName = hdrVideoRangeServerSettings[this.dataset.videoRangeType];
            config[settingName] = $(this).prop('checked');
        });

        ApiClient.updateServerConfiguration(config).then(Dashboard.processServerConfigurationUpdateResult);
    });

    return false;
}

$(document).on('pageinit', '#hdrVideoRangeConfigurationPage', function () {
    $('.hdrVideoRangeConfigurationForm').off('submit', onSubmit).on('submit', onSubmit);
}).on('pageshow', '#hdrVideoRangeConfigurationPage', function () {
    loading.show();
    const page = this;
    ApiClient.getServerConfiguration().then(function (config) {
        loadPage(page, config);
    });
});
