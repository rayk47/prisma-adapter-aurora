import { Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { DatabaseCluster } from "aws-cdk-lib/aws-rds";
import { Dashboard, GraphWidget } from "aws-cdk-lib/aws-cloudwatch";

export interface CloudwatchDashboardProps extends StackProps {
    readonly description?: string;
    readonly auroraCluster: DatabaseCluster;
    readonly dbName: string;
    readonly envName: string;

}

export class CloudwatchDashboard extends Stack {
    constructor(scope: Construct, id: string, props: CloudwatchDashboardProps) {
        const { auroraCluster, dbName, envName } = props;
        super(scope, id, props);

        const dashboard = new Dashboard(this, envName + 'AuroraMonitoringDashboard', {
            dashboardName: dbName,
        });

        dashboard.applyRemovalPolicy(RemovalPolicy.DESTROY);

        const dbConnections = auroraCluster.metricDatabaseConnections();
        const deadlocks = auroraCluster.metricDeadlocks();
        const metricServerlessDatabaseCapacity = auroraCluster.metricServerlessDatabaseCapacity();
        const metricACUUtilization = auroraCluster.metricACUUtilization();

        //  The average amount of time taken per disk I/O operation (average over 1 minute)
        const readLatency = auroraCluster.metric('ReadLatency', {
            statistic: 'Average',
            period: Duration.seconds(60),
        });

        const metricServerlessDatabaseCapacityWidget = new GraphWidget({
            title: 'Serverless Database Capacity',
            // Metrics to display on left Y axis.
            left: [metricServerlessDatabaseCapacity],
        });

        const metricACUUtilizationWidget = new GraphWidget({
            title: 'ACU Utilization',
            // Metrics to display on left Y axis.
            left: [metricACUUtilization],
        });

        const widgetDbConnections = new GraphWidget({
            title: 'DB Connections',
            // Metrics to display on left Y axis.
            left: [dbConnections],
        });

        const widgetReadLatency = new GraphWidget({
            title: 'Read Latency',
            //  Metrics to display on left Y axis.
            left: [readLatency],
        });


        const widgetDeadlocks = new GraphWidget({
            title: 'Deadlocks',
            left: [deadlocks],
        });


        dashboard.addWidgets(
            widgetDbConnections,
        );

        dashboard.addWidgets(
            metricACUUtilizationWidget,
            metricServerlessDatabaseCapacityWidget
        );

        dashboard.addWidgets(
            widgetReadLatency,
            widgetDeadlocks,
        );
    }
}
