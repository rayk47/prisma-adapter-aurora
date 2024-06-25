set -a # automatically export all variables
export $(grep -v '^#' ./.env | xargs)
set +a