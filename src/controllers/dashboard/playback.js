import 'jquery';
import loading from '../../components/loading/loading';
import { androidHdrVideoRangeServerSettings } from '../../scripts/androidHdr10';
import Dashboard from '../../utils/dashboard';

function loadPage(page, config) {
    $('#txtMinResumePct', page).val(config.MinResumePct);
    $('#txtMaxResumePct', page).val(config.MaxResumePct);
    $('#txtMinAudiobookResume', page).val(config.MinAudiobookResume);
    $('#txtMaxAudiobookResume', page).val(config.MaxAudiobookResume);
    $('#txtMinResumeDuration', page).val(config.MinResumeDurationSeconds);
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
        config.MinResumePct = $('#txtMinResumePct', form).val();
        config.MaxResumePct = $('#txtMaxResumePct', form).val();
        config.MinAudiobookResume = $('#txtMinAudiobookResume', form).val();
        config.MaxAudiobookResume = $('#txtMaxAudiobookResume', form).val();
        config.MinResumeDurationSeconds = $('#txtMinResumeDuration', form).val();
        $('.chkAndroidHdrAutoDetection', form).each(function () {
            const settingName = androidHdrVideoRangeServerSettings[this.dataset.videoRangeType];
            config[settingName] = $(this).prop('checked');
        });

        ApiClient.updateServerConfiguration(config).then(Dashboard.processServerConfigurationUpdateResult);
    });

    return false;
}

$(document).on('pageinit', '#playbackConfigurationPage', function () {
    $('.playbackConfigurationForm').off('submit', onSubmit).on('submit', onSubmit);
}).on('pageshow', '#playbackConfigurationPage', function () {
    loading.show();
    const page = this;
    ApiClient.getServerConfiguration().then(function (config) {
        loadPage(page, config);
    });
});
