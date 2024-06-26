set -a # automatically export all variables
BASEDIR=$(dirname $0)
export $(grep -v '^#' ${BASEDIR}/.env | xargs)
set +a