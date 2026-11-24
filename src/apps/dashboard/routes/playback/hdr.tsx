import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { QUERY_KEY, useConfiguration } from 'hooks/useConfiguration';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import React from 'react';
import { type ActionFunctionArgs, Form, useActionData, useNavigation } from 'react-router-dom';
import type { ServerConfiguration } from '@jellyfin/sdk/lib/generated-client/models/server-configuration';
import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';
import { hdrVideoRangeLabels, hdrVideoRangeServerSettings, hdrVideoRangeTypes } from 'scripts/hdrVideoRangePolicy';
import { ActionData } from 'types/actionData';
import { queryClient } from 'utils/query/queryClient';

export const action = async ({ request }: ActionFunctionArgs) => {
    const api = ServerConnections.getApi();
    if (!api) throw new Error('No Api instance available');

    const { data } = await getSystemApi(api).getConfiguration();
    const config = data as unknown as Record<string, unknown>;
    const formData = await request.formData();

    for (const rangeType of hdrVideoRangeTypes) {
        const settingName = hdrVideoRangeServerSettings[rangeType];
        config[settingName] = formData.get(settingName)?.toString() === 'on';
    }

    await getSystemApi(api).updateConfiguration({
        serverConfiguration: config as unknown as ServerConfiguration
    });

    void queryClient.invalidateQueries({ queryKey: [ QUERY_KEY ] });

    return { isSaved: true };
};

export const Component = () => {
    const { data: config, isPending, isError } = useConfiguration();
    const actionData = useActionData() as ActionData | undefined;
    const navigation = useNavigation();
    const isSubmitting = navigation.state === 'submitting';

    if (isPending) {
        return <Loading />;
    }

    const configValues = config as unknown as Record<string, unknown> | undefined;

    return (
        <Page
            id='hdrVideoRangeConfigurationPage'
            title={globalize.translate('HdrVideoRangeConfiguration')}
            className='mainAnimatedPage type-interior'
        >
            <Box className='content-primary'>
                {isError || !configValues ? (
                    <Alert severity='error'>{globalize.translate('HdrServerSettingsLoadError')}</Alert>
                ) : (
                    <Form method='POST'>
                        <Stack spacing={2}>
                            <Typography variant='h1'>
                                {globalize.translate('HdrVideoRangeConfiguration')}
                            </Typography>

                            <Typography>
                                {globalize.translate('HdrServerSettingsHelp')}
                            </Typography>

                            {!isSubmitting && actionData?.isSaved && (
                                <Alert severity='success'>
                                    {globalize.translate('SettingsSaved')}
                                </Alert>
                            )}

                            {hdrVideoRangeTypes.map(rangeType => {
                                const settingName = hdrVideoRangeServerSettings[rangeType];
                                return (
                                    <FormControlLabel
                                        key={rangeType}
                                        control={(
                                            <Checkbox
                                                name={settingName}
                                                defaultChecked={configValues[settingName] !== false}
                                            />
                                        )}
                                        label={globalize.translate(hdrVideoRangeLabels[rangeType])}
                                    />
                                );
                            })}

                            <Button type='submit' size='large' disabled={isSubmitting}>
                                {globalize.translate('Save')}
                            </Button>
                        </Stack>
                    </Form>
                )}
            </Box>
        </Page>
    );
};

Component.displayName = 'HdrVideoRangeConfigurationPage';
