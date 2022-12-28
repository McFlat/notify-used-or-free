# [notify-used-or-free](https://www.npmjs.com/package/notify-used-or-free)

[![Travis](https://img.shields.io/travis/FlatEarthTruth/notify-used-or-free/master.svg)](https://travis-ci.org/FlatEarthTruth/notify-used-or-free)

## Install

    $ npm install -g notify-used-or-free

Notify by email or sms of free disk space on server or when a certain amount of disk space has been used.

**Suggestion:** Install and run `notify-used-or-free` on your server using a daily cron job that runs around lunch time, so you can fix any issues after lunch.

## How to use

### show help


    Usage: notify-used-or-free <disk> <options>

    notify-used-or-free / -a 5GB -R user@email.example -u username -p password -S sendgrid


    Options:

    -V, --version                                                                                                          output the version number
    -i, --info                                                                                                             print data info
    -r, --round                                                                                                            return integer instead of floating point number eg. 1GB not 1.23GB
    -d, --detect [<used>|<free>]                                                                                           used or free space, free by default
    -m, --modifier [<less>|<more>]                                                                                         less or more than detected amount, less by default
    -a, --amount <10GB>                                                                                                    amount of space used or free on disk, eg. 1024MB, 1TB; 5GB by default
    -t, --template <{{name}} detected {{disk}} has {{out}} {{detect}} on {{hostname}}, which is {{modifier}} than {{in}}>  
    -s, --subject <[LOW|HIGH] DISK SPACE>                                                                                  send email with this subject title
    -R, --recipients [email@exam.ple, send@here.too]                                                                       email addresses to send message to
    -e, --sender-email <sender@exam.ple>                                                                                   sender email address
    -n, --sender-name <NotifyUsedOrFree>                                                                                   sender name
    -S, --service <Mailgun|Mailjet|Postmark|SendGrid|SES|SES-US-EAST-1|SES-US-WEST-2|SES-EU-WEST-1|Sparkpost>              service to use, instead of using host:port
    -H, --host <host.server>                                                                                               host of mail server, or provide service instead
    -P, --port <587>                                                                                                       port of mail server, or provide service instead
    -c, --secure                                                                                                           secure connection to send email, true by default
    -u, --user <name>                                                                                                      username on mail server
    -p, --pass <word>                                                                                                      password on mail server for username
    -L, --log <logDir>                                                                                                     save to logfile in <logDir>/.notify-used-or-free.log
    -X, --debug                                                                                                            show debug messages, false by default
    -j, --json                                                                                                             json log output, false by default
    -q, --quite                                                                                                            suppress logger output, false by default
    -A, --account-sid <ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX>                                                                 valid Twilio account sid
    -T, --auth-token <your_auth_token>                                                                                     valid Twilio auth token
    -O, --phones [+13105551234, +12065551234]                                                                              phone numbers to send message to
    -o, --sender-phone <+13105551234>                                                                                      valid Twilio phone number
    -h, --help                                                                                                             output usage information

### run command

#### using sendgrid `--service`, no `--host` and `--port` params required
    
    $ notify-used-or-free / -a 10GB -R user@example.email -S sendgrid -u username -p password
    
#### using `--host` and `--port`, instead of a `--service`
    
    $ notify-used-or-free / -a 10GB -R user@example.email -H smtp.mail.server -P 587 -u username -p password
    
## Development

    $ cd notify-used-or-free/
    $ npm i -g
    $ npm link
    

### Testing

    $ npm test
    

# License

MIT &copy; Alex Goretoy
