import { FormControlLabel, Switch } from '@material-ui/core';
import Box from '@material-ui/core/Box';
import Grid from '@material-ui/core/Grid';
import { makeStyles } from '@material-ui/core/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useLocation } from 'react-router';
import Event, { KubeEvent } from '../../lib/k8s/event';
import Node from '../../lib/k8s/node';
import Pod from '../../lib/k8s/pod';
import { useFilterFunc } from '../../lib/util';
import { setSearchFilter } from '../../redux/actions/actions';
import { Link, StatusLabel } from '../common';
import Empty from '../common/EmptyContent';
import { PageGrid } from '../common/Resource';
import ResourceTable from '../common/Resource/ResourceTable';
import { SectionBox } from '../common/SectionBox';
import SectionFilterHeader from '../common/SectionFilterHeader';
import { LightTooltip } from '../common/Tooltip';
import { CpuCircularChart, MemoryCircularChart, PodsStatusCircleChart } from './Charts';

export default function Overview() {
  const [pods, setPods] = React.useState<Pod[] | null>(null);
  const [nodes, setNodes] = React.useState<Node[] | null>(null);
  const { t } = useTranslation('cluster');

  Pod.useApiList(setPods);
  Node.useApiList(setNodes);

  const [nodeMetrics, metricsError] = Node.useMetrics();

  const noMetrics = metricsError?.status === 404;
  const noPermissions = metricsError?.status === 403;

  return (
    <PageGrid>
      <SectionBox py={2} mt={[4, 0, 0]}>
        {noPermissions ? (
          <Empty color="error">{t('auth|No permissions to list pods.')}</Empty>
        ) : (
          <Grid container justifyContent="space-around" alignItems="flex-start">
            <Grid item>
              <CpuCircularChart items={nodes} itemsMetrics={nodeMetrics} noMetrics={noMetrics} />
            </Grid>
            <Grid item>
              <MemoryCircularChart items={nodes} itemsMetrics={nodeMetrics} noMetrics={noMetrics} />
            </Grid>
            <Grid item>
              <PodsStatusCircleChart items={pods} />
            </Grid>
          </Grid>
        )}
      </SectionBox>
      <EventsSection />
    </PageGrid>
  );
}

const useStyles = makeStyles(theme => ({
  eventLabel: {
    [theme.breakpoints.up('md')]: {
      minWidth: '180px',
    },
  },
}));

function EventsSection() {
  const EVENT_WARNING_SWITCH_FILTER_STORAGE_KEY = 'EVENT_WARNING_SWITCH_FILTER_STORAGE_KEY';
  const classes = useStyles();
  const { t } = useTranslation('glossary');
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const eventsFilter = queryParams.get('eventsFilter');
  const dispatch = useDispatch();
  const filterFunc = useFilterFunc(['.jsonData.involvedObject.kind']);
  const [isWarningEventSwitchChecked, setIsWarningEventSwitchChecked] = React.useState(
    Boolean(localStorage.getItem(EVENT_WARNING_SWITCH_FILTER_STORAGE_KEY))
  );

  const warningActionFilterFunc = (event: KubeEvent) => {
    if (!filterFunc(event)) {
      return false;
    }

    if (isWarningEventSwitchChecked) {
      return event.jsonData.type === 'Warning';
    }

    // Return true because if we reach this point, it means we're only filtering by
    // the default filterFunc (and its result was 'true').
    return true;
  };

  React.useEffect(() => {
    if (!eventsFilter) {
      return;
    }
    // we want to consider search by id
    dispatch(setSearchFilter(eventsFilter));
  }, [eventsFilter]);

  function makeStatusLabel(event: Event) {
    return (
      <StatusLabel status={event.type === 'Normal' ? '' : 'warning'} className={classes.eventLabel}>
        {event.reason}
      </StatusLabel>
    );
  }

  function makeObjectLink(event: Event) {
    const obj = event.involvedObjectInstance;
    if (!!obj) {
      return <Link kubeObject={obj} />;
    }

    return event.involvedObject.name;
  }

  return (
    <SectionBox
      title={
        <SectionFilterHeader
          title={t('Events')}
          titleSideActions={[
            <FormControlLabel
              checked={isWarningEventSwitchChecked}
              label={t('Warnings')}
              control={<Switch color="primary" />}
              onChange={(event, checked) => {
                localStorage.setItem(EVENT_WARNING_SWITCH_FILTER_STORAGE_KEY, checked.toString());
                setIsWarningEventSwitchChecked(checked);
              }}
            />,
          ]}
        />
      }
    >
      <ResourceTable
        resourceClass={Event}
        columns={[
          {
            label: t('Type'),
            getter: event => event.involvedObject.kind,
            sort: true,
          },
          {
            label: t('frequent|Name'),
            getter: event => makeObjectLink(event),
            cellProps: {
              scope: 'row',
              component: 'th',
            },
            sort: true,
          },
          'namespace',
          // @todo: Maybe the message should be shown on slide-down.
          {
            label: t('Reason'),
            getter: event => (
              <LightTooltip title={event.message} interactive>
                <Box>{makeStatusLabel(event)}</Box>
              </LightTooltip>
            ),
            sort: (e1: Event, e2: Event) => e1.reason.localeCompare(e2.reason),
          },
          'age',
        ]}
        filterFunction={warningActionFilterFunc}
      />
    </SectionBox>
  );
}
