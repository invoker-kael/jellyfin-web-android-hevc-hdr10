import 'jquery';
import loading from '../../components/loading/loading';
import { androidHdrVideoRangeServerSettings } from '../../scripts/androidHdr10';
import Dashboard from '../../utils/dashboard';

function loadPage(page, config) {
    $('.chkAndroidHdrAutoDetection', page).each(function () {
        const settingName = androidHdrVideoRangeServerSettings[this.dataset.videoRangeType];
        $(this).prop('checked', config[settingName] === true);
    });
    loading.hide();
}

function onSubmit() {
    loading.show();
    const form = this;
    ApiClient.getServerConfiguration().then(function (config) {
        $('.chkAndroidHdrAutoDetection', form).each(function () {
            const settingName = androidHdrVideoRangeServerSettings[this.dataset.videoRangeType];
            config[settingName] = $(this).prop('checked');
        });

        ApiClient.updateServerConfiguration(config).then(Dashboard.processServerConfigurationUpdateResult);
    });

    return false;
}

$(document).on('pageinit', '#androidHdrConfigurationPage', function () {
    $('.androidHdrConfigurationForm').off('submit', onSubmit).on('submit', onSubmit);
}).on('pageshow', '#androidHdrConfigurationPage', function () {
    loading.show();
    const page = this;
    ApiClient.getServerConfiguration().then(function (config) {
        loadPage(page, config);
    });
});
